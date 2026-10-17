// The /beta/availability editor's model: a member's weekly "unavailable" ranges (London wall-clock
// time), validation with friendly wording, the effect on this week's outings, and a reducer that
// never lets one member's data land in another member's form (the PER-269 rule).
import {
  DAYS_OF_WEEK,
  isValidTimeFormat,
  minutesToTime,
  rangesOverlap,
  timeToMinutes,
  validateWeeklyAvailability,
  type DayOfWeek,
  type TimeRange,
} from '@/types/rowerAvailability';
import type { UnavailabilityRow } from '@/lib/live/types';
import { fitFor } from './availability';

export type WeekDays = Record<DayOfWeek, TimeRange[]>;

export const MAX_RANGES = 3;
/** The current app's "No availability" button stores the whole day as 00:00–23:59. */
export const WHOLE_DAY: TimeRange = { start: '00:00', end: '23:59' };

export function emptyWeek(): WeekDays {
  return { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
}

/** The seven days of a row (or of nothing: a member with no row yet is free all week). */
export function daysFromRow(row: Partial<Record<DayOfWeek, unknown>> | null | undefined): WeekDays {
  const out = emptyWeek();
  if (!row) return out;
  for (const day of DAYS_OF_WEEK) {
    const v = row[day];
    if (!Array.isArray(v)) continue;
    out[day] = v
      .filter((r): r is TimeRange => !!r && typeof r === 'object' && typeof r.start === 'string' && typeof r.end === 'string')
      .map((r) => ({ start: r.start, end: r.end }));
  }
  return out;
}

export function sameWeek(a: WeekDays, b: WeekDays): boolean {
  return DAYS_OF_WEEK.every(
    (d) => a[d].length === b[d].length && a[d].every((r, i) => r.start === b[d][i].start && r.end === b[d][i].end),
  );
}

export function isWholeDay(ranges: TimeRange[]): boolean {
  return ranges.length === 1 && ranges[0].start === WHOLE_DAY.start && ranges[0].end === WHOLE_DAY.end;
}

export type RangeIssue = 'format' | 'order' | 'overlap';

/** What is wrong with range `i` of a day, if anything (the same rules as validateDayRanges). */
export function rangeIssue(ranges: TimeRange[], i: number): RangeIssue | null {
  const r = ranges[i];
  if (!isValidTimeFormat(r.start) || !isValidTimeFormat(r.end)) return 'format';
  if (timeToMinutes(r.end) <= timeToMinutes(r.start)) return 'order';
  const clash = ranges.some(
    (o, j) => j !== i && isValidTimeFormat(o.start) && isValidTimeFormat(o.end) && timeToMinutes(o.end) > timeToMinutes(o.start) && rangesOverlap(r, o),
  );
  return clash ? 'overlap' : null;
}

const ISSUE_TEXT: Record<RangeIssue, string> = {
  format: 'Enter both times as HH:MM.',
  order: 'End must be after start.',
  overlap: 'Times overlap. Merge or move them.',
};

/** One friendly line for a day, or null when it is valid. */
export function dayError(ranges: TimeRange[]): string | null {
  if (ranges.length > MAX_RANGES) return `At most ${MAX_RANGES} ranges a day.`;
  for (let i = 0; i < ranges.length; i++) {
    const issue = rangeIssue(ranges, i);
    if (issue) return ISSUE_TEXT[issue];
  }
  return null;
}

/** The server's check (the /api/live/unavailability schema runs the same function). */
export function weekIsValid(days: WeekDays): boolean {
  return validateWeeklyAvailability(days).valid;
}

/** Quick ranges for the common parts of a rowing day (early water, lectures, evening). */
export const PRESETS: { label: string; range: TimeRange }[] = [
  { label: 'Early', range: { start: '06:00', end: '09:00' } },
  { label: 'Daytime', range: { start: '09:00', end: '17:00' } },
  { label: 'Evening', range: { start: '17:00', end: '21:00' } },
];

/** Whether `range` can be added to the day without breaking the rules. */
export function canAdd(ranges: TimeRange[], range: TimeRange): boolean {
  if (ranges.length >= MAX_RANGES) return false;
  return dayError([...ranges, range]) === null && !ranges.some((r) => r.start === range.start && r.end === range.end);
}

/**
 * The range "+ Add" inserts: 09:00–17:00 on an empty day (as the current app), otherwise the
 * two hours after the latest range ends (clamped to the end of the day).
 */
export function nextRange(ranges: TimeRange[]): TimeRange {
  const ends = ranges.filter((r) => isValidTimeFormat(r.end)).map((r) => timeToMinutes(r.end));
  if (ends.length === 0) return { start: '09:00', end: '17:00' };
  const start = Math.min(Math.max(...ends), 23 * 60);
  const end = Math.min(start + 120, 23 * 60 + 59);
  return { start: minutesToTime(start), end: minutesToTime(end) };
}

/** Ranges in time order, so the list reads top to bottom. Invalid times stay where they are. */
export function sortRanges(ranges: TimeRange[]): TimeRange[] {
  if (!ranges.every((r) => isValidTimeFormat(r.start))) return ranges;
  return [...ranges].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

export type EffectOuting = { id: string; name: string; start_at: string | null; end_at: string | null };

/**
 * How a week of ranges affects the outings still to come: the ones this member would show as
 * Unavailable or Maybe free for in the crew picker (the same fitFor the drawer uses).
 */
export function weekEffect<O extends EffectOuting>(days: WeekDays, outings: O[], now: Date) {
  const upcoming = outings.filter((o) => o.start_at && new Date(o.start_at) >= now);
  const unavailable: O[] = [];
  const maybe: O[] = [];
  for (const o of upcoming) {
    const fit = fitFor(days, new Date(o.start_at!), o.end_at ? new Date(o.end_at) : null);
    if (fit === 'unavailable') unavailable.push(o);
    else if (fit === 'maybe') maybe.push(o);
  }
  return { upcoming: upcoming.length, unavailable, maybe };
}

/** -1 previous day, +1 next day, 0 not a swipe (too short, or mostly vertical scrolling). */
export function swipeStep(dx: number, dy: number, threshold = 50): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

// ------------------------------------------------------------------ editor state

export type Base = { days: WeekDays; version: number; updatedBy: string | null; updatedAt: string | null };

export type EditorState = {
  memberId: string | null;
  load: 'idle' | 'loading' | 'ready' | 'error';
  base: Base | null; // what the database holds (as far as we know)
  draft: WeekDays | null; // what is on screen
  saving: boolean;
  /** Someone else saved this member while you had unsaved edits (their member id). */
  staleBy: string | null | undefined;
  early: UnavailabilityRow | null; // a Realtime row that arrived while loading
};

export type EditorAction =
  | { type: 'select'; memberId: string | null }
  | { type: 'loaded'; memberId: string; row: UnavailabilityRow | null }
  | { type: 'failed'; memberId: string }
  | { type: 'edit'; day: DayOfWeek; ranges: TimeRange[] }
  | { type: 'discard' }
  | { type: 'reload' }
  | { type: 'remote'; row: UnavailabilityRow }
  | { type: 'save-start' }
  | { type: 'saved'; memberId: string; row: UnavailabilityRow }
  | { type: 'save-failed' }
  | { type: 'conflict'; memberId: string; current: UnavailabilityRow | null };

export const initialEditor: EditorState = {
  memberId: null,
  load: 'idle',
  base: null,
  draft: null,
  saving: false,
  staleBy: undefined,
  early: null,
};

function baseFrom(row: UnavailabilityRow | null): Base {
  return {
    days: daysFromRow(row),
    version: row?.version ?? 0, // no row yet: the RPC creates it at version 0
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function ready(state: EditorState, row: UnavailabilityRow | null): EditorState {
  const base = baseFrom(row);
  return { ...state, load: 'ready', base, draft: base.days, saving: false, staleBy: undefined, early: null };
}

export function isDirty(state: EditorState): boolean {
  return !!state.draft && !!state.base && !sameWeek(state.draft, state.base.days);
}

/** The grid may be shown and saved only for the selected member's own, successfully loaded data. */
export function canEdit(state: EditorState, selectedId: string | null): boolean {
  return !!selectedId && state.memberId === selectedId && state.load === 'ready' && !!state.base && !!state.draft;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'select':
      if (action.memberId === state.memberId && state.load !== 'error') return state;
      return { ...initialEditor, memberId: action.memberId, load: action.memberId ? 'loading' : 'idle' };
    case 'loaded': {
      if (action.memberId !== state.memberId || state.load !== 'loading') return state; // a stale response
      const early = state.early;
      const row = early && (!action.row || early.version > action.row.version) ? early : action.row;
      return ready(state, row);
    }
    case 'failed':
      if (action.memberId !== state.memberId || state.load !== 'loading') return state;
      return { ...state, load: 'error', base: null, draft: null };
    case 'edit':
      if (state.load !== 'ready' || !state.draft || state.saving) return state;
      return { ...state, draft: { ...state.draft, [action.day]: action.ranges } };
    case 'discard':
      if (!state.base) return state;
      return { ...state, draft: state.base.days };
    case 'reload':
      if (!state.memberId || state.saving) return state;
      return { ...initialEditor, memberId: state.memberId, load: 'loading' };
    case 'remote': {
      const { row } = action;
      if (row.member_id !== state.memberId) return state;
      if (state.load === 'loading') {
        return !state.early || row.version > state.early.version ? { ...state, early: row } : state;
      }
      if (state.load !== 'ready' || !state.base || !state.draft) return state;
      if (row.version <= state.base.version) return state; // an echo of what we already have
      const days = daysFromRow(row);
      // Unchanged on screen, or the echo of our own save racing its response: take it
      if (!isDirty(state) || sameWeek(days, state.draft)) {
        return { ...state, base: baseFrom(row), draft: days, staleBy: undefined };
      }
      // You have unsaved edits: keep them, but say someone else saved (a save will be refused)
      return { ...state, staleBy: row.updated_by };
    }
    case 'save-start':
      return state.load === 'ready' ? { ...state, saving: true } : state;
    case 'saved':
      if (action.memberId !== state.memberId) return state;
      if (state.base && action.row.version < state.base.version) return { ...state, saving: false };
      return ready(state, action.row);
    case 'save-failed':
      return { ...state, saving: false };
    case 'conflict':
      if (action.memberId !== state.memberId) return state;
      // Show what is saved now; with no row to show, load it again
      return action.current ? ready(state, action.current) : { ...initialEditor, memberId: state.memberId, load: 'loading' };
    default:
      return state;
  }
}
