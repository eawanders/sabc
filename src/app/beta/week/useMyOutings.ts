'use client';
// The signed-in member's seats in [from, to): read with the anon key, kept live with Realtime,
// replies saved through /api/live/seat/status with the member the user saw in the seat
// (expectedMemberId), optimistic with rollback on conflict, and undo of your own replies.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { getBrowserClient, subscribeToTable } from '@/lib/live/realtime';
import { setSeatStatus, undoChange } from '@/lib/live/write';
import type { SeatRow } from '@/lib/live/types';
import { useIdentity } from '../_components/Identity';
import { useToast } from '../_components/Toasts';
import { conflictMessage } from '../_lib/messages';
import { loadMine } from '../_lib/myweek-load';
import { emptyMine, inFilter, mineReducer, myRows, type MyOuting } from '../_lib/myweek-state';
import { seatLabel } from '../_lib/seats';

export type SavedNote = { changeId: number; at: number };

const SAVED_MS = 8000;

export function useMyOutings(fromIso: string, toIso: string) {
  const { actorId, requireActor } = useIdentity();
  const toast = useToast();
  const [state, dispatch] = useReducer(mineReducer, emptyMine);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [saved, setSaved] = useState<Record<string, SavedNote>>({});
  const stateRef = useRef(state);
  stateRef.current = state;
  const actorRef = useRef(actorId);
  actorRef.current = actorId;
  const opSeq = useRef(0);
  const undoStack = useRef<{ changeId: number; key: string }[]>([]);
  const loadSeq = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      const client = getBrowserClient();
      const me = actorRef.current;
      if (!me) return;
      if (!client) {
        setLoadState('error');
        return;
      }
      const seq = ++loadSeq.current;
      if (!quiet) setLoadState('loading');
      let loaded: Awaited<ReturnType<typeof loadMine>>;
      try {
        loaded = await loadMine(client, me, fromIso, toIso);
      } catch {
        if (seq === loadSeq.current && !quiet) setLoadState('error');
        return;
      }
      if (seq !== loadSeq.current) return;
      dispatch({ type: 'load', ...loaded });
      setLoadState('ready');
    },
    [fromIso, toIso],
  );

  // (Re)load when the member or the range changes
  useEffect(() => {
    undoStack.current = [];
    setSaved({});
    if (!actorId) {
      loadSeq.current++;
      dispatch({ type: 'load', outings: [], rows: [] });
      setLoadState('idle');
      return;
    }
    void load();
  }, [actorId, load]);

  // A seat newly given to me (in an outing not on screen yet) means a reload; debounce bursts
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadSoon = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => void load(true), 400);
  }, [load]);
  useEffect(() => () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
  }, []);

  const onSeat = useCallback(
    (row: SeatRow | null) => {
      if (!row) return;
      if (stateRef.current.seats[row.outing_id]) dispatch({ type: 'seat', outingId: row.outing_id, action: { type: 'remote', row } });
      else if (row.member_id === actorRef.current) reloadSoon();
    },
    [reloadSoon],
  );

  // Realtime: my seats anywhere, every seat of the outings on screen, and those outings
  const ids = useMemo(() => Object.keys(state.outings).sort(), [state.outings]);
  const idsKey = ids.join(',');
  useEffect(() => {
    if (!actorId) return;
    return subscribeToTable<SeatRow>('outing_seats', (c) => onSeat(c.new), { filter: `member_id=eq.${actorId}` });
  }, [actorId, onSeat]);
  useEffect(() => {
    const seatFilter = inFilter('outing_id', idsKey ? idsKey.split(',') : []);
    const outingFilter = inFilter('id', idsKey ? idsKey.split(',') : []);
    if (!seatFilter || !outingFilter) return;
    const offSeats = subscribeToTable<SeatRow>('outing_seats', (c) => onSeat(c.new), { filter: seatFilter });
    const offOutings = subscribeToTable<MyOuting>(
      'outings',
      (c) => {
        if (c.new) dispatch({ type: 'outing', outing: c.new });
      },
      { filter: outingFilter },
    );
    return () => {
      offSeats();
      offOutings();
    };
  }, [idsKey, onSeat]);

  // Catch up after the tab was in the background (Realtime may have dropped)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const markSaved = useCallback((key: string, changeId: number) => {
    const at = Date.now();
    setSaved((s) => ({ ...s, [key]: { changeId, at } }));
    setTimeout(() => setSaved((s) => (s[key]?.at === at ? omit(s, key) : s)), SAVED_MS);
  }, []);

  const undo = useCallback(
    async (changeId: number) => {
      const entry = undoStack.current.find((e) => e.changeId === changeId);
      undoStack.current = undoStack.current.filter((e) => e.changeId !== changeId);
      const actor = actorRef.current;
      if (!actor) return;
      if (entry) setSaved((s) => omit(s, entry.key));
      const result = await undoChange({ changeId, actorId: actor });
      if (result.ok) {
        for (const row of [result.row, ...(result.rows ?? [])]) {
          if (isSeatRow(row)) dispatch({ type: 'seat', outingId: row.outing_id, action: { type: 'remote', row } });
        }
        if (result.outingStatus && isSeatRow(result.row)) {
          dispatch({ type: 'outing', outing: { id: result.row.outing_id, status: result.outingStatus.to } });
        }
        toast(`Undone${entry ? `: ${seatLabel(entry.key.split('|')[1])}` : ''}`);
      } else if (result.reason === 'conflict') {
        toast(result.message === 'already undone' ? 'Already undone.' : `Can't undo: ${result.updatedByName ?? 'someone'} changed it since.`, {
          warn: true,
        });
      } else {
        toast("Couldn't undo. Try again.", { warn: true });
      }
    },
    [toast],
  );

  const undoLast = useCallback(() => {
    const last = undoStack.current[undoStack.current.length - 1];
    if (!last) {
      toast('Nothing to undo');
      return;
    }
    void undo(last.changeId);
  }, [toast, undo]);

  /** Reply for one of my seats. The member sent as expected is the one on screen when tapped. */
  const reply = useCallback(
    async (outingId: string, seat: string, status: string) => {
      const seats = stateRef.current.seats[outingId];
      const seen = seats?.rows[seat];
      if (!seen || seats.pending[seat]) return; // one write per seat at a time
      if (seen.status === status) return;
      const actor = await requireActor();
      if (!actor) return;
      const key = `${outingId}|${seat}`;
      const opId = ++opSeq.current;
      dispatch({ type: 'seat', outingId, action: { type: 'optimistic', opId, seat, patch: { status } } });
      setSaved((s) => omit(s, key));
      const result = await setSeatStatus({ outingId, seat, status, actorId: actor, expectedMemberId: seen.member_id });
      if (result.ok) {
        dispatch({ type: 'seat', outingId, action: { type: 'settled', opId, seat, rows: [result.row, ...(result.rows ?? [])] } });
        if (result.outingStatus) dispatch({ type: 'outing', outing: { id: outingId, status: result.outingStatus.to } });
        undoStack.current.push({ changeId: result.changeId, key });
        markSaved(key, result.changeId);
        return;
      }
      if (result.reason === 'conflict') {
        const current = result.current;
        if (current && current.seat === seat) dispatch({ type: 'seat', outingId, action: { type: 'settled', opId, seat, rows: [current] } });
        else dispatch({ type: 'seat', outingId, action: { type: 'failed', opId, seat } });
        toast(conflictMessage(seat, result), { warn: true });
        return;
      }
      dispatch({ type: 'seat', outingId, action: { type: 'failed', opId, seat } });
      toast(result.message ? `Not saved: ${result.message}` : 'Not saved. Check your connection and try again.', { warn: true });
    },
    [markSaved, requireActor, toast],
  );

  const rows = useMemo(() => myRows(state, actorId), [state, actorId]);

  return { actorId, rows, loadState, saved, reply, undo, undoLast, reload: load };
}

function isSeatRow(row: unknown): row is SeatRow {
  return !!row && typeof row === 'object' && typeof (row as SeatRow).seat === 'string' && typeof (row as SeatRow).outing_id === 'string';
}

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
}
