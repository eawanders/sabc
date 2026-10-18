// Month view helpers, in London dates ('YYYY-MM-DD'), built on ../../_lib/time.
import { addDays, londonParts, londonToUtc, mondayOf } from '../../_lib/time';

export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthOf(date: Date): string {
  const p = londonParts(date);
  return `${p.y}-${String(p.m).padStart(2, '0')}`;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The days the month grid shows: Monday of the first week to Sunday of the last, whole weeks. */
export function monthGrid(month: string): { days: string[]; start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const gridStart = mondayOf(new Date(`${first}T12:00:00Z`));
  const gridEnd = addDays(mondayOf(new Date(`${last}T12:00:00Z`)), 7); // exclusive
  const days: string[] = [];
  for (let d = gridStart; d < gridEnd; d = addDays(d, 1)) days.push(d);
  const [sy, sm, sd] = gridStart.split('-').map(Number);
  const [ey, em, ed] = gridEnd.split('-').map(Number);
  return { days, start: londonToUtc(sy, sm, sd), end: londonToUtc(ey, em, ed) };
}

/** 'YYYY-MM-DD' of an instant in London. */
export function londonDate(date: Date): string {
  const p = londonParts(date);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
}
