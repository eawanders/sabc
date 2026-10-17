// The week list's data: published outings in one London week, with how many crew seats are filled.
// Reads with the anon key (RLS shows published outings only), so it is safe on the server and in tests.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CREW_SEATS } from './seats';
import { weekRange } from './time';

export type WeekOuting = {
  id: string;
  name: string;
  type: string | null;
  div: string | null;
  shell: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  crewFilled: number;
};

export function anonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function loadWeek(client: SupabaseClient, mondayIso: string): Promise<WeekOuting[]> {
  const { start, end } = weekRange(mondayIso);
  const { data: outings, error } = await client
    .from('outings')
    .select('id, name, type, div, shell, start_at, end_at, status')
    .gte('start_at', start.toISOString())
    .lt('start_at', end.toISOString())
    .order('start_at', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(`outings: ${error.message}`);
  if (!outings?.length) return [];

  const { data: seats, error: seatError } = await client
    .from('outing_seats')
    .select('outing_id, seat')
    .in('outing_id', outings.map((o) => o.id))
    .in('seat', [...CREW_SEATS])
    .not('member_id', 'is', null);
  if (seatError) throw new Error(`outing_seats: ${seatError.message}`);

  const filled = new Map<string, number>();
  for (const s of seats ?? []) filled.set(s.outing_id, (filled.get(s.outing_id) ?? 0) + 1);
  return outings.map((o) => ({ ...o, crewFilled: filled.get(o.id) ?? 0 }));
}
