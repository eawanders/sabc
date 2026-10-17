// My week's read: the outings starting in [from, to) where `memberId` holds a seat, and every seat
// of those outings (for crew counts and Realtime). Anon key; RLS limits it to published outings.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeatRow } from '@/lib/live/types';
import type { MyOuting } from './myweek-state';

const OUTING_COLS = 'id, name, type, div, shell, start_at, end_at, status';

export async function loadMine(
  client: SupabaseClient,
  memberId: string,
  fromIso: string,
  toIso: string,
): Promise<{ outings: MyOuting[]; rows: SeatRow[] }> {
  const mine = await client
    .from('outing_seats')
    .select(`outing_id, outings!inner(${OUTING_COLS})`)
    .eq('member_id', memberId)
    .gte('outings.start_at', fromIso)
    .lt('outings.start_at', toIso);
  if (mine.error) throw new Error(`outing_seats: ${mine.error.message}`);
  const outings = new Map<string, MyOuting>();
  for (const r of (mine.data ?? []) as unknown as { outings: MyOuting | MyOuting[] | null }[]) {
    const o = Array.isArray(r.outings) ? r.outings[0] : r.outings;
    if (o) outings.set(o.id, o);
  }
  if (outings.size === 0) return { outings: [], rows: [] };
  const seats = await client.from('outing_seats').select('*').in('outing_id', [...outings.keys()]);
  if (seats.error) throw new Error(`outing_seats: ${seats.error.message}`);
  return { outings: [...outings.values()], rows: (seats.data ?? []) as SeatRow[] };
}
