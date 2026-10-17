'use client';
// Marshal slots, live: server-rendered rows, Realtime on marshal_slots (the anon key only hears
// published slots), first-wins sign-ups through /api/live/marshal-slot/claim, and undo.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { getBrowserClient, subscribeToTable } from '@/lib/live/realtime';
import { claimMarshalSlot, undoChange } from '@/lib/live/write';
import type { LiveResult } from '@/lib/live/types';
import { loadMembers } from '../_lib/directory';
import {
  MARSHAL_COLUMNS,
  initSlots,
  performClaim,
  slotReducer,
  viewSlots,
  type MarshalSlot,
} from '../_lib/club-marshal';
import { useIdentity } from '../_components/Identity';
import { useToast } from '../_components/Toasts';

const FLASH_MS = 1200;
type Undoable = { changeId: number; label: string };

const send = (input: { slotId: string; memberId: string | null; actorId: string; expectedVersion: number }) =>
  claimMarshalSlot(input) as Promise<LiveResult<MarshalSlot>>;

export function useMarshalSlots(initial: MarshalSlot[], initialNames: Record<string, string>) {
  const [state, dispatch] = useReducer(slotReducer, initial, initSlots);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [names, setNames] = useState(initialNames);
  const namesRef = useRef(names);
  namesRef.current = names;
  const [flash, setFlash] = useState<Record<string, number>>({});
  const { actorId, requireActor } = useIdentity();
  const actorRef = useRef(actorId);
  actorRef.current = actorId;
  const toast = useToast();
  const undoStack = useRef<Undoable[]>([]);
  const opSeq = useRef(0);

  useEffect(() => {
    loadMembers()
      .then((ms) => setNames((n) => ({ ...Object.fromEntries(ms.map((m) => [m.id, m.name])), ...n })))
      .catch(() => {});
  }, []);

  const flashSlot = useCallback((id: string) => {
    const at = Date.now();
    setFlash((f) => ({ ...f, [id]: at }));
    setTimeout(
      () =>
        setFlash((f) => {
          if (f[id] !== at) return f;
          const next = { ...f };
          delete next[id];
          return next;
        }),
      FLASH_MS,
    );
  }, []);

  const reload = useCallback(async () => {
    const client = getBrowserClient();
    if (!client) return;
    const { data, error } = await client.from('marshal_slots').select(MARSHAL_COLUMNS);
    if (error || !data) return;
    const rows = data as unknown as MarshalSlot[];
    const seen = new Set(rows.map((r) => r.id));
    for (const row of rows) dispatch({ type: 'remote', row });
    for (const id of Object.keys(stateRef.current.rows)) if (!seen.has(id)) dispatch({ type: 'hide', id });
  }, []);

  // Realtime: sign-up rushes show up as they happen
  useEffect(() => {
    const off = subscribeToTable<MarshalSlot>('marshal_slots', (change) => {
      if (change.eventType === 'DELETE') {
        if (change.old?.id) dispatch({ type: 'hide', id: change.old.id });
        return;
      }
      const row = change.new;
      if (!row) return;
      if ((row as { publish?: boolean }).publish === false) {
        dispatch({ type: 'hide', id: row.id });
        return;
      }
      const before = stateRef.current.rows[row.id];
      dispatch({ type: 'remote', row });
      if (row.person_id && !(row.person_id in namesRef.current)) {
        loadMembers()
          .then((ms) => {
            const m = ms.find((x) => x.id === row.person_id);
            if (m) setNames((n) => ({ ...n, [m.id]: m.name }));
          })
          .catch(() => {});
      }
      const changed = !before || before.person_id !== row.person_id || before.person_status !== row.person_status;
      if (changed && row.updated_by !== actorRef.current) flashSlot(row.id);
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [flashSlot, reload]);

  const undoEntry = useCallback(
    async (entry: Undoable) => {
      undoStack.current = undoStack.current.filter((e) => e !== entry);
      const actor = actorRef.current;
      if (!actor) return;
      const result = await undoChange({ changeId: entry.changeId, actorId: actor });
      if (result.ok) {
        const row = result.row as MarshalSlot | null;
        if (row && typeof row.id === 'string' && typeof row.version === 'number') dispatch({ type: 'remote', row });
        toast(`Undone: ${entry.label}`);
      } else if (result.reason === 'conflict') {
        toast(
          result.message === 'already undone'
            ? 'Already undone.'
            : `Can't undo: ${result.updatedByName ?? 'someone'} changed this slot since.`,
          { warn: true },
        );
      } else {
        toast("Couldn't undo. Try again.", { warn: true });
      }
    },
    [toast],
  );

  /** Sign `memberId` up for a slot (null clears). `who` is the name for the toast. */
  const claim = useCallback(
    async (slotId: string, memberId: string | null, who?: string) => {
      const slot = stateRef.current.rows[slotId];
      if (!slot || stateRef.current.pending[slotId]) return;
      const actor = await requireActor();
      if (!actor) return;
      const outcome = await performClaim(slot, memberId, actor, ++opSeq.current, dispatch, send);
      if (outcome.kind === 'ok') {
        const label = memberId ? `${who ?? 'Signed up'} → ${slot.name}` : `Cleared ${slot.name}`;
        const entry = { changeId: outcome.changeId, label: slot.name };
        undoStack.current.push(entry);
        toast(label, { onUndo: () => void undoEntry(entry) });
      } else {
        if (outcome.kind === 'conflict') flashSlot(slotId);
        toast(outcome.text, { warn: true });
      }
    },
    [requireActor, toast, undoEntry, flashSlot],
  );

  const undoLast = useCallback(() => {
    const entry = undoStack.current[undoStack.current.length - 1];
    if (!entry) {
      toast('Nothing to undo');
      return;
    }
    void undoEntry(entry);
  }, [toast, undoEntry]);

  const slots = useMemo(() => viewSlots(state), [state]);
  const addName = useCallback((id: string, name: string) => setNames((n) => ({ ...n, [id]: name })), []);

  return { slots, pending: state.pending, names, addName, flash, claim, undoLast };
}
