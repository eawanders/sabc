// Command-palette grouping: who is free for this outing, from member_unavailability (weekly
// "unavailable" ranges in London wall-clock time) against the outing's start/end.
import { timeToMinutes, type DayOfWeek, type TimeRange } from '@/types/rowerAvailability';
import { londonParts, shortDay, hhmm } from './time';

export type Fit = 'free' | 'maybe' | 'unavailable';

export type WeeklyUnavailability = Partial<Record<DayOfWeek, TimeRange[]>>;

/**
 * free: no unavailable range touches the outing (or nothing recorded, as the current app treats it);
 * maybe: a range overlaps part of the outing; unavailable: ranges cover all of it.
 * An outing with no end is treated as a point in time at its start.
 */
export function fitFor(unavailability: WeeklyUnavailability | undefined, start: Date, end: Date | null): Fit {
  const s = londonParts(start);
  const ranges = unavailability?.[s.weekday] ?? [];
  if (ranges.length === 0) return 'free';
  const a = s.hh * 60 + s.mm;
  let b = a + 1;
  if (end) {
    const e = londonParts(end);
    // An outing that runs past midnight is judged on its first day only
    b = e.y === s.y && e.m === s.m && e.d === s.d ? e.hh * 60 + e.mm : 24 * 60;
    if (b <= a) b = a + 1;
  }
  const overlaps = ranges
    .map((r) => [timeToMinutes(r.start), timeToMinutes(r.end)] as const)
    .filter(([rs, re]) => rs < b && re > a)
    .sort((x, y) => x[0] - y[0]);
  if (overlaps.length === 0) return 'free';
  // Covered if the overlapping ranges leave no gap between a and b
  let cursor = a;
  for (const [rs, re] of overlaps) {
    if (rs > cursor) break;
    cursor = Math.max(cursor, re);
  }
  return cursor >= b ? 'unavailable' : 'maybe';
}

export type PickerMember = { id: string; name: string };

export type PickerItem<M extends PickerMember = PickerMember> =
  | { kind: 'clear' }
  | { kind: 'group'; fit: Fit; title: string }
  | { kind: 'member'; member: M; fit: Fit; seatedIn: string | null };

/** "Free Mon 07:00" */
export function freeTitle(start: Date): string {
  return `Free ${shortDay(start)} ${hhmm(start)}`;
}

/**
 * The palette's rows: an optional "Clear seat", then members matching `query` grouped
 * Free / Maybe free / Unavailable, alphabetical within a group.
 */
export function pickerItems<M extends PickerMember>(opts: {
  members: M[];
  unavailability: Record<string, WeeklyUnavailability>;
  start: Date | null;
  end: Date | null;
  query: string;
  seatedIn: Record<string, string>; // member id → seat they hold in this outing
  canClear: boolean;
}): PickerItem<M>[] {
  const q = opts.query.trim().toLowerCase();
  const matches = opts.members
    .filter((m) => m.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const items: PickerItem<M>[] = [];
  if (opts.canClear && !q) items.push({ kind: 'clear' });
  const titles: Record<Fit, string> = {
    free: opts.start ? freeTitle(opts.start) : 'Members',
    maybe: 'Maybe free',
    unavailable: 'Unavailable',
  };
  const fits = new Map(matches.map((m) => [m.id, opts.start ? fitFor(opts.unavailability[m.id], opts.start, opts.end) : 'free']));
  for (const fit of ['free', 'maybe', 'unavailable'] as const) {
    const group = matches.filter((m) => fits.get(m.id) === fit);
    if (group.length === 0) continue;
    items.push({ kind: 'group', fit, title: titles[fit] });
    for (const member of group) items.push({ kind: 'member', member, fit, seatedIn: opts.seatedIn[member.id] ?? null });
  }
  return items;
}
