'use client';
// Every listed test's slots, live: server-rendered rows, Realtime on swim_test_slots, optimistic
// writes through /api/live/test-slot/* with first-wins conflicts, "Book me", and undo.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getBrowserClient, subscribeToTable } from '@/lib/live/realtime';
import { claimTestSlot, setTestOutcome, undoChange } from '@/lib/live/write';
import type { LiveResult, TestSlotRow } from '@/lib/live/types';
import { useIdentity } from '../_components/Identity';
import { useToast } from '../_components/Toasts';
import { loadSlots, type BetaTest } from '../_lib/tests-data';
import {
  bookedMessage,
  fullMessage,
  outcomeConflictMessage,
  slotChangeMessage,
  slotLabel,
  takenMessage,
} from '../_lib/tests-messages';
import { bookFirstFree, emptySlotState, slotKey, slotReducer, viewSlot, type Outcome, type SlotPatch } from '../_lib/tests-state';

type Undoable = { changeId: number; slot: number };

const FLASH_MS = 1200;

export function useTestSlots(initial: TestSlotRow[], memberName: (id: string | null) => string | null) {
  const [state, dispatch] = useReducer(slotReducer, initial, (rows) => slotReducer(emptySlotState, { type: 'merge', rows }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const [flash, setFlash] = useState<Record<string, number>>({});
  const undoStack = useRef<Undoable[]>([]);
  const opSeq = useRef(0);
  const { actorId, requireActor } = useIdentity();
  const actorRef = useRef(actorId);
  actorRef.current = actorId;
  const toast = useToast();
  const nameRef = useRef(memberName);
  nameRef.current = memberName;
  const testIds = useRef(new Set<string>());
  // Slots with one of our writes in flight (a ref, so it is current inside Book me's retry loop)
  const inflight = useRef(new Set<string>());
  const booking = useRef(new Set<string>()); // tests with a Book me in progress: a double tap books once

  // Rows the server rendered for a new list (upcoming ↔ past, filters) join the store
  useEffect(() => {
    for (const r of initial) testIds.current.add(r.test_id);
    dispatch({ type: 'merge', rows: initial });
  }, [initial]);

  const flashSlot = useCallback((key: string) => {
    const at = Date.now();
    setFlash((f) => ({ ...f, [key]: at }));
    setTimeout(() => setFlash((f) => (f[key] === at ? omit(f, key) : f)), FLASH_MS);
  }, []);

  const merge = useCallback((rows: TestSlotRow[]) => {
    for (const r of rows) testIds.current.add(r.test_id);
    dispatch({ type: 'merge', rows });
  }, []);

  // Realtime for every test (a handful of rows change per day, bursts during sign-ups)
  useEffect(() => {
    const off = subscribeToTable<TestSlotRow>('swim_test_slots', (change) => {
      const row = change.new;
      if (!row) return;
      dispatch({ type: 'merge', rows: [row] });
      const old = change.old;
      const changed = !old || old.member_id !== row.member_id || old.outcome !== row.outcome;
      if (changed && row.updated_by !== actorRef.current) flashSlot(slotKey(row.test_id, row.slot));
    });
    // Catch up after the tab was in the background (Realtime may have dropped)
    const onVisible = () => {
      const client = getBrowserClient();
      if (document.visibilityState !== 'visible' || !client || testIds.current.size === 0) return;
      loadSlots(client, [...testIds.current])
        .then((rows) => dispatch({ type: 'merge', rows }))
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [flashSlot]);

  const undoEntry = useCallback(
    async (entry: Undoable) => {
      undoStack.current = undoStack.current.filter((e) => e !== entry);
      const actor = actorRef.current;
      if (!actor) return;
      const result = await undoChange({ changeId: entry.changeId, actorId: actor });
      if (result.ok) {
        if (isSlotRow(result.row)) dispatch({ type: 'merge', rows: [result.row] });
        toast(`Undone: ${slotLabel(entry.slot)}`);
      } else if (result.reason === 'conflict') {
        toast(
          result.message === 'already undone'
            ? 'Already undone.'
            : `Can't undo: ${result.updatedByName ?? 'someone'} changed ${slotLabel(entry.slot)} since.`,
          { warn: true },
        );
      } else {
        toast("Couldn't undo. Try again.", { warn: true });
      }
    },
    [toast],
  );

  const remember = useCallback(
    (changeId: number, slot: number, text: string) => {
      const entry = { changeId, slot };
      undoStack.current.push(entry);
      toast(text, { onUndo: () => void undoEntry(entry) });
    },
    [toast, undoEntry],
  );

  /** One optimistic write to one slot; resolves to the server's answer (rows already applied). */
  const send = useCallback(
    async (
      testId: string,
      slot: number,
      patch: SlotPatch,
      call: (seen: TestSlotRow) => Promise<LiveResult<TestSlotRow>>,
    ): Promise<LiveResult<TestSlotRow> | null> => {
      const key = slotKey(testId, slot);
      const seen = stateRef.current.rows[key];
      if (!seen || inflight.current.has(key)) return null; // one write per slot at a time
      inflight.current.add(key);
      const opId = ++opSeq.current;
      dispatch({ type: 'optimistic', opId, key, patch });
      const result = await call(seen).finally(() => inflight.current.delete(key));
      if (result.ok) dispatch({ type: 'settled', opId, key, rows: [result.row] });
      else if (result.reason === 'conflict' && result.current) {
        dispatch({ type: 'settled', opId, key, rows: [result.current] });
        flashSlot(key);
      } else dispatch({ type: 'failed', opId, key });
      return result;
    },
    [flashSlot],
  );

  const failToast = useCallback(
    (result: Exclude<LiveResult<TestSlotRow>, { ok: true }>) =>
      toast(result.message ? `Not saved: ${result.message}` : 'Not saved. Check your connection and try again.', { warn: true }),
    [toast],
  );

  /** Put `memberId` in a slot (null clears it). First wins: a stale view gets "taken by X". */
  const assign = useCallback(
    async (testId: string, slot: number, memberId: string | null, opts: { name?: string; seenVersion?: number } = {}) => {
      const actor = await requireActor();
      if (!actor) return;
      const cur = viewSlot(stateRef.current, testId, slot);
      // The version on screen when the person acted (e.g. when they opened the picker): if someone
      // booked the slot since, this write loses instead of replacing them
      const result = await send(
        testId,
        slot,
        { member_id: memberId, outcome: memberId ? (keepOutcome(cur?.outcome) ?? 'Test Booked') : 'No Show' },
        (seen) =>
          claimTestSlot({ testId, slot, memberId, actorId: actor, expectedVersion: opts.seenVersion ?? seen.version }),
      );
      if (!result) return;
      if (result.ok) {
        const name = opts.name ?? nameRef.current(memberId) ?? 'Member';
        remember(result.changeId, slot, slotChangeMessage(slot, memberId ? { memberName: name } : { cleared: true }));
      } else if (result.reason === 'conflict') toast(takenMessage(slot, result), { warn: true });
      else failToast(result);
    },
    [requireActor, send, remember, toast, failToast],
  );

  const setOutcome = useCallback(
    async (testId: string, slot: number, outcome: Outcome) => {
      const cur = viewSlot(stateRef.current, testId, slot);
      if (!cur?.member_id || cur.outcome === outcome) return;
      const actor = await requireActor();
      if (!actor) return;
      const result = await send(testId, slot, { outcome }, (seen) =>
        setTestOutcome({ testId, slot, outcome, actorId: actor, expectedMemberId: seen.member_id }),
      );
      if (!result) return;
      if (result.ok) remember(result.changeId, slot, slotChangeMessage(slot, { outcome }));
      else if (result.reason === 'conflict') toast(outcomeConflictMessage(slot, result), { warn: true });
      else failToast(result);
    },
    [requireActor, send, remember, toast, failToast],
  );

  /** One tap: the first free slot, moving on to the next one if someone beats you to it. */
  const bookMe = useCallback(
    async (test: BetaTest) => {
      if (test.start_at && new Date(test.start_at).getTime() <= Date.now()) {
        toast('This test has already started.');
        return;
      }
      const me = await requireActor();
      if (!me || booking.current.has(test.id)) return;
      booking.current.add(test.id);
      const out = await bookFirstFree({
        available: test.available_slots,
        me,
        row: (s) => viewSlot(stateRef.current, test.id, s),
        busy: (s) => inflight.current.has(slotKey(test.id, s)),
        claim: async (slot, expectedVersion) =>
          (await send(test.id, slot, { member_id: me, outcome: 'Test Booked' }, () =>
            claimTestSlot({ testId: test.id, slot, memberId: me, actorId: me, expectedVersion }),
          )) ?? { ok: false, reason: 'error', message: 'Already saving that slot' },
      }).finally(() => booking.current.delete(test.id));
      switch (out.kind) {
        case 'booked':
          remember(out.result.changeId, out.slot, bookedMessage(out.slot, out.lost));
          break;
        case 'already':
          toast(`You're already in ${slotLabel(out.slot)}.`);
          break;
        case 'full':
          toast(fullMessage(out.lost), { warn: true });
          break;
        case 'failed':
          failToast(out.result);
          break;
      }
    },
    [requireActor, send, remember, toast, failToast],
  );

  const undoLast = useCallback(() => {
    const entry = undoStack.current[undoStack.current.length - 1];
    if (!entry) {
      toast('Nothing to undo');
      return;
    }
    void undoEntry(entry);
  }, [toast, undoEntry]);

  return { state, flash, merge, assign, setOutcome, bookMe, undoLast };
}

export type TestSlots = ReturnType<typeof useTestSlots>;

// As claim_test_slot: a booking keeps Passed / Failed / Test Booked, otherwise becomes Test Booked
function keepOutcome(outcome: string | null | undefined): string | null {
  return outcome === 'Passed' || outcome === 'Failed' || outcome === 'Test Booked' ? outcome : null;
}

function isSlotRow(row: unknown): row is TestSlotRow {
  return !!row && typeof row === 'object' && typeof (row as TestSlotRow).test_id === 'string' && 'slot' in row;
}

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  const next = { ...obj };
  delete next[key];
  return next;
}
