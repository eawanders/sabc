// Home dashboard data, read with the anon key on the server for the first paint. Each section loads
// on its own, so one failing query shows an error in that section only.
import type { SupabaseClient } from '@supabase/supabase-js';
import { DAYS_OF_WEEK, timeToMinutes, type TimeRange } from '@/types/rowerAvailability';
import type { WeeklyUnavailability } from './availability';
import { CREW_SEATS } from './seats';
import { dayLabel, hhmm } from './time';

export type HomeOuting = {
  id: string;
  name: string;
  type: string | null;
  div: string | null;
  start_at: string;
  end_at: string | null;
  status: string | null;
  crewFilled: number;
};

export type RecentOuting = HomeOuting & { hasReport: boolean };

/** A day in a cox's week: free all day, free for part of it, or blocked all day. */
export type DayFit = 'free' | 'partial' | 'blocked';

export type CoxWeek = { id: string; name: string; days: DayFit[] }; // Monday first

export type HomeTest = {
  id: string;
  title: string;
  type: string | null;
  start_at: string;
  end_at: string | null;
  booked: number;
  slots: number;
  full: boolean;
};

export type HomeEvent = {
  id: string;
  title: string;
  start_at: string;
  all_day: boolean;
  hasForm: boolean;
};

export type Section<T> = { data: T; error: null } | { data: null; error: string };

export type HomeData = {
  sessions: Section<HomeOuting[]>;
  recent: Section<RecentOuting[]>;
  coxes: Section<CoxWeek[]>;
  tests: Section<HomeTest[]>;
  nextEvent: Section<HomeEvent | null>;
};

const DAY_END = 23 * 60 + 59;

/** blocked: the ranges cover 00:00–23:59; partial: some range; free: none. */
export function dayFit(ranges: TimeRange[] | undefined): DayFit {
  if (!ranges || ranges.length === 0) return 'free';
  const sorted = ranges.map((r) => [timeToMinutes(r.start), timeToMinutes(r.end)] as const).sort((a, b) => a[0] - b[0]);
  let cursor = 0;
  for (const [s, e] of sorted) {
    if (s > cursor) break;
    cursor = Math.max(cursor, e);
  }
  return cursor >= DAY_END ? 'blocked' : 'partial';
}

/**
 * The coxing overview, as the current app's Home card: members with any cox experience, each
 * weekday free unless blocked all day; coxes blocked all seven days are left out. Sorted by name.
 */
export function coxWeeks(
  members: { id: string; name: string; cox_experience: string | null }[],
  unavailability: Record<string, WeeklyUnavailability>,
): CoxWeek[] {
  return members
    .filter((m) => (m.cox_experience ?? '').trim() !== '')
    .map((m) => ({ id: m.id, name: m.name, days: DAYS_OF_WEEK.map((d) => dayFit(unavailability[m.id]?.[d])) }))
    .filter((c) => c.days.some((d) => d !== 'blocked'))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** "Sat 25 Oct, 19:00", or "Sat 25 Oct" for an all-day event. */
export function whenLabel(startIso: string, allDay = false): string {
  const d = new Date(startIso);
  return allDay ? dayLabel(d) : `${dayLabel(d)}, ${hhmm(d)}`;
}

/** Red or black flag: no crews are allowed out (the current app's banner). */
export function isNoGoFlag(flag: string | null | undefined): boolean {
  const f = (flag ?? '').toLowerCase().replace(/\s*flag$/, '').trim();
  return f === 'red' || f === 'black';
}

/** "Green flag" from "Green" or "Green Flag"; null when unknown. */
export function flagLabel(flag: string | null | undefined): string | null {
  if (!flag) return null;
  const base = flag.replace(/\s*flag$/i, '').trim();
  return base ? `${base} flag` : null;
}

function hasText(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

async function crewCounts(client: SupabaseClient, ids: string[]): Promise<Map<string, number>> {
  const filled = new Map<string, number>();
  if (ids.length === 0) return filled;
  const { data, error } = await client
    .from('outing_seats')
    .select('outing_id')
    .in('outing_id', ids)
    .in('seat', [...CREW_SEATS])
    .not('member_id', 'is', null);
  if (error) throw new Error(`outing_seats: ${error.message}`);
  for (const s of data ?? []) filled.set(s.outing_id, (filled.get(s.outing_id) ?? 0) + 1);
  return filled;
}

const OUTING_COLS = 'id, name, type, div, start_at, end_at, status';

/** Sessions happening now or later (cancelled ones included, as today), soonest first. */
async function loadSessions(client: SupabaseClient, now: Date, limit: number): Promise<HomeOuting[]> {
  const t = now.toISOString();
  const { data, error } = await client
    .from('outings')
    .select(OUTING_COLS)
    .or(`end_at.gte.${t},and(end_at.is.null,start_at.gte.${t})`)
    .not('start_at', 'is', null)
    .order('start_at', { ascending: true })
    .order('name', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`outings: ${error.message}`);
  const rows = (data ?? []) as Omit<HomeOuting, 'crewFilled'>[];
  const filled = await crewCounts(client, rows.map((o) => o.id));
  return rows.map((o) => ({ ...o, crewFilled: filled.get(o.id) ?? 0 }));
}

/** Confirmed water outings that have finished, most recent first, with whether a report exists. */
async function loadRecent(client: SupabaseClient, now: Date, limit: number): Promise<RecentOuting[]> {
  const { data, error } = await client
    .from('outings')
    .select(OUTING_COLS)
    .eq('type', 'Water Outing')
    .eq('status', 'Confirmed')
    .lt('end_at', now.toISOString())
    .order('end_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`outings: ${error.message}`);
  const rows = (data ?? []) as Omit<HomeOuting, 'crewFilled'>[];
  const ids = rows.map((o) => o.id);
  const [filled, reports] = await Promise.all([
    crewCounts(client, ids),
    ids.length
      ? client.from('outing_reports').select('outing_id, outing_summary, boat_feel, outing_successes, next_focus, coach_feedback').in('outing_id', ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (reports.error) throw new Error(`outing_reports: ${reports.error.message}`);
  const withReport = new Set(
    (reports.data ?? [])
      .filter((r) => Object.entries(r).some(([k, v]) => k !== 'outing_id' && hasText(v)))
      .map((r) => r.outing_id as string),
  );
  return rows.map((o) => ({ ...o, crewFilled: filled.get(o.id) ?? 0, hasReport: withReport.has(o.id) }));
}

async function loadCoxes(client: SupabaseClient): Promise<CoxWeek[]> {
  const { data: members, error } = await client
    .from('members')
    .select('id, name, cox_experience')
    .not('cox_experience', 'is', null);
  if (error) throw new Error(`members: ${error.message}`);
  const ids = (members ?? []).map((m) => m.id as string);
  const unavailability: Record<string, WeeklyUnavailability> = {};
  if (ids.length) {
    const { data, error: uErr } = await client
      .from('member_unavailability')
      .select('member_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday')
      .in('member_id', ids);
    // Unknown availability must not read as "free all week"
    if (uErr) throw new Error(`member_unavailability: ${uErr.message}`);
    for (const row of data ?? []) {
      const { member_id, ...days } = row as { member_id: string } & WeeklyUnavailability;
      unavailability[member_id] = days;
    }
  }
  return coxWeeks(members ?? [], unavailability);
}

async function loadTests(client: SupabaseClient, now: Date, limit: number): Promise<HomeTest[]> {
  const t = now.toISOString();
  const { data, error } = await client
    .from('swim_tests')
    .select('id, title, type, available_slots, start_at, end_at')
    .or(`end_at.gte.${t},and(end_at.is.null,start_at.gte.${t})`)
    .not('start_at', 'is', null)
    .order('start_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`swim_tests: ${error.message}`);
  const tests = data ?? [];
  const booked = new Map<string, number>();
  if (tests.length) {
    const { data: slots, error: sErr } = await client
      .from('swim_test_slots')
      .select('test_id, slot')
      .in('test_id', tests.map((x) => x.id))
      .not('member_id', 'is', null);
    if (sErr) throw new Error(`swim_test_slots: ${sErr.message}`);
    // Only slots the test offers count (a test can shrink after people booked)
    const offered = new Map(tests.map((x) => [x.id as string, x.available_slots as number]));
    for (const s of slots ?? []) {
      if (s.slot <= (offered.get(s.test_id) ?? 0)) booked.set(s.test_id, (booked.get(s.test_id) ?? 0) + 1);
    }
  }
  return tests.map((x) => {
    const n = booked.get(x.id) ?? 0;
    return {
      id: x.id,
      title: x.title,
      type: x.type,
      start_at: x.start_at,
      end_at: x.end_at,
      booked: n,
      slots: x.available_slots,
      full: n >= x.available_slots,
    };
  });
}

async function loadNextEvent(client: SupabaseClient, now: Date): Promise<HomeEvent | null> {
  const { data, error } = await client
    .from('events')
    .select('id, title, start_at, all_day, embedded_form')
    .gte('start_at', now.toISOString())
    .order('start_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`events: ${error.message}`);
  if (!data) return null;
  return { id: data.id, title: data.title, start_at: data.start_at, all_day: data.all_day, hasForm: hasText(data.embedded_form) };
}

async function section<T>(p: Promise<T>, what: string): Promise<Section<T>> {
  try {
    return { data: await p, error: null };
  } catch {
    return { data: null, error: `Couldn't load ${what}.` };
  }
}

export async function loadHome(client: SupabaseClient, now: Date = new Date()): Promise<HomeData> {
  const [sessions, recent, coxes, tests, nextEvent] = await Promise.all([
    section(loadSessions(client, now, 6), 'sessions'),
    section(loadRecent(client, now, 3), 'recent outings'),
    section(loadCoxes(client), 'cox availability'),
    section(loadTests(client, now, 3), 'swim tests'),
    section(loadNextEvent(client, now), 'events'),
  ]);
  return { sessions, recent, coxes, tests, nextEvent };
}
