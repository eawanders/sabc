// Schedule filters, held in the URL so a filtered view can be shared and survives a reload:
//   ?type=water|erg|tank|gym  ?div=<Div>  ?member=<member id>  (plus week / view / month / outing)
// Filtering runs in the browser over the outings the page already loaded, so it is instant.
import type { ScheduleOuting } from './load';

export const TYPE_FILTERS = {
  water: 'Water Outing',
  erg: 'Erg Session',
  tank: 'Tank Session',
  gym: 'Gym Session',
} as const;
export type TypeFilter = keyof typeof TYPE_FILTERS;

export type Filters = { type: TypeFilter | null; div: string | null; member: string | null };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Params = { get(name: string): string | null };

export function readFilters(params: Params): Filters {
  const type = params.get('type');
  const div = params.get('div')?.trim();
  const member = params.get('member')?.toLowerCase();
  return {
    type: type && Object.hasOwn(TYPE_FILTERS, type) ? (type as TypeFilter) : null,
    div: div && div.length <= 40 ? div : null,
    member: member && ID.test(member) ? member : null,
  };
}

/** A new query string with `next` applied (null removes a filter); other params are kept. */
export function withFilters(current: string, next: Partial<Filters>): string {
  const q = new URLSearchParams(current);
  for (const [key, value] of Object.entries(next)) {
    if (value) q.set(key, value);
    else q.delete(key);
  }
  return q.toString();
}

export function hasFilters(f: Filters): boolean {
  return Boolean(f.type || f.div || f.member);
}

export function applyFilters(outings: ScheduleOuting[], f: Filters): ScheduleOuting[] {
  return outings.filter(
    (o) =>
      (!f.type || o.type === TYPE_FILTERS[f.type]) &&
      (!f.div || o.div === f.div) &&
      (!f.member || o.seats.some((s) => s.member_id === f.member)),
  );
}

/** The divisions present in what was loaded, for the division menu. */
export function divisions(outings: ScheduleOuting[]): string[] {
  return [...new Set(outings.map((o) => o.div).filter((d): d is string => Boolean(d)))].sort((a, b) => a.localeCompare(b));
}
