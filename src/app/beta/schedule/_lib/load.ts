// The schedule's data: published outings in a London date range, each with who sits where.
// Reads with the anon key (RLS shows published outings only), so it is safe on the server and in tests.
import type { SupabaseClient } from '@supabase/supabase-js';
import { CREW_SEATS } from '../../_lib/seats';

export type ScheduleOuting = {
  id: string;
  name: string;
  type: string | null;
  div: string | null;
  shell: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  crewFilled: number;
  /** Every filled seat (crew, bank rider, subs). */
  seats: { seat: string; member_id: string }[];
};

const PAGE = 1000; // PostgREST max_rows (supabase/config.toml)
const IN_CHUNK = 150; // outing ids per `in` filter, to keep the URL short

/** Water outings count nine crew seats (cox to bow); other sessions have no cox, so eight. */
export function crewSize(type: string | null): number {
  return type === 'Water Outing' ? 9 : 8;
}

export function countCrew(type: string | null, seats: { seat: string }[]): number {
  const counted = new Set<string>(type === 'Water Outing' ? CREW_SEATS : CREW_SEATS.filter((s) => s !== 'Cox'));
  return seats.filter((s) => counted.has(s.seat)).length;
}

export async function loadSchedule(client: SupabaseClient, start: Date, end: Date): Promise<ScheduleOuting[]> {
  const outings: Omit<ScheduleOuting, 'crewFilled' | 'seats'>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('outings')
      .select('id, name, type, div, shell, start_at, end_at, status')
      .gte('start_at', start.toISOString())
      .lt('start_at', end.toISOString())
      .order('start_at', { ascending: true })
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`outings: ${error.message}`);
    outings.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  if (outings.length === 0) return [];

  const seats = new Map<string, { seat: string; member_id: string }[]>();
  for (let i = 0; i < outings.length; i += IN_CHUNK) {
    const ids = outings.slice(i, i + IN_CHUNK).map((o) => o.id);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client
        .from('outing_seats')
        .select('outing_id, seat, member_id')
        .in('outing_id', ids)
        .not('member_id', 'is', null)
        .order('outing_id', { ascending: true })
        .order('seat', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`outing_seats: ${error.message}`);
      for (const s of data ?? []) {
        const list = seats.get(s.outing_id) ?? [];
        list.push({ seat: s.seat, member_id: s.member_id });
        seats.set(s.outing_id, list);
      }
      if (!data || data.length < PAGE) break;
    }
  }
  return outings.map((o) => {
    const s = seats.get(o.id) ?? [];
    return { ...o, seats: s, crewFilled: countCrew(o.type, s) };
  });
}
