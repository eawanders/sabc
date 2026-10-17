// Everyone's weekly unavailability, kept live for the crew drawer's picker grouping: one read with
// the anon key, then Realtime on member_unavailability while anything is listening. A save on
// /beta/availability also writes its row in here at once, so the drawer is right even before the
// Realtime echo arrives (or if Realtime is down).
import { useSyncExternalStore } from 'react';
import { getBrowserClient, subscribeToTable } from '@/lib/live/realtime';
import type { UnavailabilityRow } from '@/lib/live/types';
import type { WeeklyUnavailability } from './availability';
import { daysFromRow } from './availability-edit';

type Snapshot = Record<string, WeeklyUnavailability>;

const EMPTY: Snapshot = {};
let snapshot: Snapshot = EMPTY;
const versions = new Map<string, number>();
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function emit() {
  for (const l of listeners) l();
}

/** Merge one row (from Realtime, a save or an undo). Older versions than we hold are ignored. */
export function applyUnavailabilityRow(row: Pick<UnavailabilityRow, 'member_id' | 'version'> & Partial<UnavailabilityRow>): void {
  const held = versions.get(row.member_id);
  if (held !== undefined && row.version < held) return;
  versions.set(row.member_id, row.version);
  snapshot = { ...snapshot, [row.member_id]: daysFromRow(row) };
  emit();
}

function start() {
  const client = getBrowserClient();
  if (!client) return () => {};
  let cancelled = false;
  // Subscribe first so nothing between the read and the subscription is missed
  const off = subscribeToTable<UnavailabilityRow>('member_unavailability', (change) => {
    if (change.new) applyUnavailabilityRow(change.new);
    else if (change.old) {
      versions.delete(change.old.member_id);
      const next = { ...snapshot };
      delete next[change.old.member_id];
      snapshot = next;
      emit();
    }
  });
  void (async () => {
    const { data, error } = await client
      .from('member_unavailability')
      .select('member_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, version');
    if (cancelled || error) return;
    for (const r of (data ?? []) as UnavailabilityRow[]) {
      const held = versions.get(r.member_id);
      if (held !== undefined && r.version < held) continue;
      versions.set(r.member_id, r.version);
      snapshot = { ...snapshot, [r.member_id]: daysFromRow(r) };
    }
    emit();
  })();
  return () => {
    cancelled = true;
    off();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!stop) stop = start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stop) {
      stop();
      stop = null;
    }
  };
}

/** member id → weekly unavailability, live. Empty until the first read lands. */
export function useLiveUnavailability(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}
