'use client';
// One outing's crew, live: initial read with the anon key, Realtime for seats and the outing,
// optimistic writes through /api/live/* (liveWrite helpers) with rollback on conflict, and undo.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getBrowserClient, subscribeToOutingSeats, subscribeToTable } from '@/lib/live/realtime';
import { claimSeat, setSeatStatus, swapSeats, undoChange } from '@/lib/live/write';
import type { LiveResult, SeatRow } from '@/lib/live/types';
import { conflictMessage, changeMessage } from '../_lib/messages';
import { emptySeatState, seatReducer, viewSeat, type SeatPatch } from '../_lib/seatState';
import { seatLabel } from '../_lib/seats';
import { createUndoStack } from '../_lib/undo-stack';
import { useIdentity } from './Identity';
import { useToast } from './Toasts';

export type CrewOuting = {
  id: string;
  name: string;
  type: string | null;
  div: string | null;
  shell: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  details?: string | null;
};

const FLASH_MS = 1200;
// A new person starts as Awaiting Approval (as in the prototype); a cleared seat is reset to it too
const NEW_STATUS = 'Awaiting Approval';

export function useCrew(outingId: string, memberName: (id: string | null) => string | null) {
  const [outing, setOuting] = useState<CrewOuting | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [seats, dispatch] = useReducer(seatReducer, emptySeatState);
  const [flash, setFlash] = useState<Record<string, number>>({});
  const seatsRef = useRef(seats);
  seatsRef.current = seats;
  // Shared with the report tab (useReport), so ⌘Z undoes whichever change was most recent
  const [undo] = useState(createUndoStack);
  const opSeq = useRef(0);
  const { actorId, requireActor } = useIdentity();
  const actorRef = useRef(actorId);
  actorRef.current = actorId;
  const toast = useToast();
  const nameRef = useRef(memberName);
  nameRef.current = memberName;

  const flashSeat = useCallback((seat: string) => {
    const at = Date.now();
    setFlash((f) => ({ ...f, [seat]: at }));
    setTimeout(() => setFlash((f) => (f[seat] === at ? omit(f, seat) : f)), FLASH_MS);
  }, []);

  const reloadSeats = useCallback(async () => {
    const client = getBrowserClient();
    if (!client) return;
    const { data } = await client.from('outing_seats').select('*').eq('outing_id', outingId);
    for (const row of (data ?? []) as SeatRow[]) dispatch({ type: 'remote', row });
  }, [outingId]);

  // Initial load + Realtime
  useEffect(() => {
    const client = getBrowserClient();
    if (!client) {
      setLoadState('error');
      return;
    }
    let cancelled = false;
    setLoadState('loading');
    undo.clear();

    // Subscribe first so nothing between the read and the subscription is missed
    const offSeats = subscribeToOutingSeats<SeatRow>(outingId, (change) => {
      const row = change.new;
      if (!row) return;
      dispatch({ type: 'remote', row });
      const old = change.old;
      const changed = !old || old.member_id !== row.member_id || old.status !== row.status;
      if (changed && row.updated_by !== actorRef.current) flashSeat(row.seat);
    });
    const offOuting = subscribeToTable<CrewOuting>(
      'outings',
      (change) => {
        if (change.new) setOuting((o) => (o ? { ...o, ...change.new } : change.new));
      },
      { filter: `id=eq.${outingId}` },
    );

    (async () => {
      const [o, s] = await Promise.all([
        client.from('outings').select('id, name, type, div, shell, start_at, end_at, status, details').eq('id', outingId).maybeSingle(),
        client.from('outing_seats').select('*').eq('outing_id', outingId),
      ]);
      if (cancelled) return;
      if (o.error || s.error) {
        setLoadState('error');
        return;
      }
      if (!o.data) {
        setLoadState('missing');
        return;
      }
      setOuting(o.data as CrewOuting);
      dispatch({ type: 'load', rows: (s.data ?? []) as SeatRow[] });
      setLoadState('ready');
    })();

    // Catch up after the tab was in the background (Realtime may have dropped)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reloadSeats();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      offSeats();
      offOuting();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [outingId, flashSeat, reloadSeats, undo]);

  const undoEntry = useCallback(
    async (entry: { changeId: number; seat: string }) => {
      const actor = actorRef.current;
      if (!actor) return;
      const result = await undoChange({ changeId: entry.changeId, actorId: actor });
      if (result.ok) {
        const rows = [result.row, ...(result.rows ?? [])].filter(isSeatRow);
        for (const row of rows) dispatch({ type: 'remote', row });
        if (result.outingStatus) setOuting((o) => (o ? { ...o, status: result.outingStatus!.to } : o));
        toast(`Undone: ${seatLabel(entry.seat)}`);
      } else if (result.reason === 'conflict') {
        toast(
          result.message === 'already undone'
            ? 'Already undone.'
            : `Can't undo: ${result.updatedByName ?? 'someone'} changed ${seatLabel(entry.seat)} since.`,
          { warn: true },
        );
      } else {
        toast("Couldn't undo. Try again.", { warn: true });
      }
    },
    [toast],
  );

  const settle = useCallback(
    (seats: string[], opId: number, result: LiveResult<SeatRow>, describe: string) => {
      const [seat] = seats;
      if (result.ok) {
        const rows = [result.row, ...(result.rows ?? [])];
        for (const s of seats) dispatch({ type: 'settled', opId, seat: s, rows });
        if (result.outingStatus) setOuting((o) => (o ? { ...o, status: result.outingStatus!.to } : o));
        const entry = { changeId: result.changeId, seat };
        const handle = undo.push({ undo: () => undoEntry(entry) });
        toast(result.outingStatus ? `${describe} · outing ${result.outingStatus.to.toLowerCase()}` : describe, {
          onUndo: handle.undo,
        });
        return;
      }
      if (result.reason === 'conflict') {
        const current = result.current;
        for (const s of seats) {
          if (current && current.seat === s) dispatch({ type: 'settled', opId, seat: s, rows: [current] });
          else dispatch({ type: 'failed', opId, seat: s });
        }
        const lost = current && seats.includes(current.seat) ? current.seat : seat;
        flashSeat(lost);
        toast(conflictMessage(lost, result), { warn: true });
        return;
      }
      for (const s of seats) dispatch({ type: 'failed', opId, seat: s });
      toast(result.message ? `Not saved: ${result.message}` : 'Not saved. Check your connection and try again.', { warn: true });
    },
    [flashSeat, toast, undoEntry, undo],
  );

  /** One write over one or two seats: optimistic patches now, the server's answer settles them. */
  const write = useCallback(
    async (
      changes: { seat: string; patch: SeatPatch }[],
      send: (actor: string, seen: SeatRow[]) => Promise<LiveResult<SeatRow>>,
      describe: string,
    ) => {
      const seen = changes.map((c) => seatsRef.current.rows[c.seat]);
      // One write per seat at a time; the version sent is the one on screen when the user acted
      if (seen.some((r) => !r) || changes.some((c) => seatsRef.current.pending[c.seat])) return;
      const actor = await requireActor();
      if (!actor) return;
      const opId = ++opSeq.current;
      for (const c of changes) dispatch({ type: 'optimistic', opId, seat: c.seat, patch: c.patch });
      settle(
        changes.map((c) => c.seat),
        opId,
        await send(actor, seen),
        describe,
      );
    },
    [requireActor, settle],
  );

  const assign = useCallback(
    (seat: string, memberId: string | null) => {
      const describe = changeMessage(seat, memberId ? { memberName: nameRef.current(memberId) ?? 'Member' } : { cleared: true });
      return write(
        [{ seat, patch: { member_id: memberId, status: NEW_STATUS } }],
        (actor, [seen]) =>
          claimSeat({ outingId, seat, memberId, status: NEW_STATUS, actorId: actor, expectedVersion: seen.version }),
        describe,
      );
    },
    [outingId, write],
  );

  /** Move someone already in this outing to `to` (swapping with whoever is there), in one save. */
  const move = useCallback(
    (from: string, to: string) => {
      const a = viewSeat(seatsRef.current, from);
      const b = viewSeat(seatsRef.current, to);
      if (!a || !b) return Promise.resolve();
      const name = nameRef.current(a.member_id) ?? 'Member';
      return write(
        [
          { seat: to, patch: { member_id: a.member_id, status: a.status } },
          { seat: from, patch: { member_id: b.member_id, status: b.status } },
        ],
        (actor, [seenTo, seenFrom]) =>
          swapSeats({
            outingId,
            seatA: from,
            seatB: to,
            actorId: actor,
            expectedVersionA: seenFrom.version,
            expectedVersionB: seenTo.version,
          }),
        `${name} → ${seatLabel(to)}${b.member_id ? ` (swapped with ${seatLabel(from)})` : ''}`,
      );
    },
    [outingId, write],
  );

  const setStatus = useCallback(
    (seat: string, status: string) =>
      write(
        [{ seat, patch: { status } }],
        (actor, [seen]) => setSeatStatus({ outingId, seat, status, actorId: actor, expectedMemberId: seen.member_id }),
        changeMessage(seat, { status }),
      ),
    [outingId, write],
  );

  /** Hold a seat with no one named (Reserved), as "Reserved - Don't Change" did. */
  const reserve = useCallback(
    (seat: string) =>
      write(
        [{ seat, patch: { member_id: null, status: 'Reserved' } }],
        (actor, [seen]) =>
          claimSeat({ outingId, seat, memberId: null, status: 'Reserved', actorId: actor, expectedVersion: seen.version }),
        `${seatLabel(seat)} reserved`,
      ),
    [outingId, write],
  );

  /**
   * Swap in subs: each pair is one atomic seat/swap (member and status), so the rower seat gets the
   * sub (Available) and the sub seat the rower (Not Available). Pairs go one after another; each
   * has its own undo. Stops at the first pair that doesn't go through (the toast says why).
   */
  const swapSubs = useCallback(
    async (pairs: { crew: string; sub: string }[]) => {
      for (const { crew, sub } of pairs) {
        const a = viewSeat(seatsRef.current, crew);
        const b = viewSeat(seatsRef.current, sub);
        if (!a || !b) return;
        const before = undo.size();
        await write(
          [
            { seat: crew, patch: { member_id: b.member_id, status: b.status } },
            { seat: sub, patch: { member_id: a.member_id, status: a.status } },
          ],
          (actor, [seenCrew, seenSub]) =>
            swapSeats({
              outingId,
              seatA: crew,
              seatB: sub,
              actorId: actor,
              expectedVersionA: seenCrew.version,
              expectedVersionB: seenSub.version,
            }),
          `${nameRef.current(b.member_id) ?? 'Sub'} in for ${nameRef.current(a.member_id) ?? 'rower'} at ${seatLabel(crew)}`,
        );
        if (undo.size() === before) return;
      }
    },
    [outingId, write, undo],
  );

  /** ⌘Z: the most recent change in the drawer, a seat change or a report save. */
  const undoLast = useCallback(() => {
    if (!undo.undoLast()) toast('Nothing to undo');
  }, [toast, undo]);

  return {
    outing,
    loadState,
    seats,
    view: (seat: string) => viewSeat(seats, seat),
    flash,
    assign,
    move,
    setStatus,
    reserve,
    swapSubs,
    undo,
    undoLast,
  };
}

function isSeatRow(row: unknown): row is SeatRow {
  return !!row && typeof row === 'object' && typeof (row as SeatRow).seat === 'string' && 'version' in row;
}

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  const next = { ...obj };
  delete next[key];
  return next;
}
