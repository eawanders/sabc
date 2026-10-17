// Reading Notion property values (API 2025-09-03 page objects) into plain values.
// Every reader tolerates a missing property or a different property type and
// returns null/empty instead of throwing, so one odd page never stops a sync.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Prop = any;

export function plainText(prop: Prop): string | null {
  const parts = prop?.title ?? prop?.rich_text;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((p: { plain_text?: string }) => p?.plain_text ?? '').join('').trim();
  return text || null;
}

/** Name of a select or status option. */
export function optionName(prop: Prop): string | null {
  return prop?.select?.name ?? prop?.status?.name ?? null;
}

/** multi_select option names; a single select becomes a one-element array. */
export function optionNames(prop: Prop): string[] {
  if (Array.isArray(prop?.multi_select)) {
    return prop.multi_select.map((o: { name?: string }) => o?.name).filter((n: unknown): n is string => typeof n === 'string');
  }
  const single = optionName(prop);
  return single ? [single] : [];
}

export function checkbox(prop: Prop): boolean {
  return prop?.checkbox === true;
}

export function numberValue(prop: Prop): number | null {
  return typeof prop?.number === 'number' ? prop.number : null;
}

export function uniqueIdNumber(prop: Prop): number | null {
  return typeof prop?.unique_id?.number === 'number' ? prop.unique_id.number : null;
}

export function relationIds(prop: Prop): string[] {
  if (!Array.isArray(prop?.relation)) return [];
  return prop.relation.map((r: { id?: string }) => r?.id).filter((id: unknown): id is string => typeof id === 'string');
}

/**
 * Midnight in Europe/London on a YYYY-MM-DD date, as an ISO string with offset.
 * London changes clocks at 01:00 UTC, so the offset in force at 00:00 UTC on
 * the same calendar day is the offset at London midnight.
 */
export function londonMidnight(date: string): string {
  const utcMidnight = new Date(`${date}T00:00:00Z`);
  const tzName = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', timeZoneName: 'longOffset' })
    .formatToParts(utcMidnight)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const offset = tzName === 'GMT' ? '+00:00' : tzName.replace('GMT', '');
  return `${date}T00:00:00${offset}`;
}

function toTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.includes('T') ? value : londonMidnight(value);
}

export interface DateRange {
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
}

/** A Notion date property. Date-only values become midnight Europe/London with all_day = true. */
export function dateRange(prop: Prop): DateRange {
  const date = prop?.date;
  if (!date?.start) return { start_at: null, end_at: null, all_day: false };
  return {
    start_at: toTimestamp(date.start),
    end_at: toTimestamp(date.end),
    all_day: !String(date.start).includes('T'),
  };
}
