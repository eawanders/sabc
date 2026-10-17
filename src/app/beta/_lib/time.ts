// Europe/London wall-clock helpers (the club's time zone), built on Intl only.
import type { DayOfWeek } from '@/types/rowerAvailability';

export const TZ = 'Europe/London';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'long',
  hourCycle: 'h23',
});

export type LondonParts = { y: number; m: number; d: number; hh: number; mm: number; weekday: DayOfWeek };

export function londonParts(date: Date): LondonParts {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFmt.formatToParts(date)) p[type] = value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    hh: Number(p.hour),
    mm: Number(p.minute),
    weekday: p.weekday.toLowerCase() as DayOfWeek,
  };
}

/** The UTC instant of a London wall-clock time (handles BST/GMT, including the change-over days). */
export function londonToUtc(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let t = wall;
  for (let i = 0; i < 2; i++) {
    const p = londonParts(new Date(t));
    const asWall = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
    t += wall - asWall;
  }
  return new Date(t);
}

/** 'YYYY-MM-DD' of the Monday of the London week containing `date`. */
export function mondayOf(date: Date): string {
  const p = londonParts(date);
  const idx = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(p.weekday);
  const monday = new Date(Date.UTC(p.y, p.m - 1, p.d - idx));
  return monday.toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** [start, end) of the London week starting on Monday `iso`, as UTC instants. */
export function weekRange(mondayIso: string): { start: Date; end: Date } {
  const [y, m, d] = mondayIso.split('-').map(Number);
  const [y2, m2, d2] = addDays(mondayIso, 7).split('-').map(Number);
  return { start: londonToUtc(y, m, d), end: londonToUtc(y2, m2, d2) };
}

export function hhmm(date: Date): string {
  const p = londonParts(date);
  return `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`;
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const shortDayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' });

/** "Mon 19 Oct" */
export function dayLabel(date: Date): string {
  return dayFmt.format(date).replace(',', '');
}

/** "Mon" */
export function shortDay(date: Date): string {
  return shortDayFmt.format(date);
}

/** "19–25 Oct" or "27 Oct – 2 Nov" for the week starting on Monday `iso`. */
export function weekLabel(mondayIso: string): string {
  const { start } = weekRange(mondayIso);
  const sunday = weekRange(addDays(mondayIso, 6)).start;
  const f = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).format(d);
  const sameMonth = f(start, { month: 'short' }) === f(sunday, { month: 'short' });
  return sameMonth
    ? `${f(start, { day: 'numeric' })}–${f(sunday, { day: 'numeric', month: 'short' })}`
    : `${f(start, { day: 'numeric', month: 'short' })} – ${f(sunday, { day: 'numeric', month: 'short' })}`;
}
