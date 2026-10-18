// /beta/marshalling?slot=<id>: marshal and umpire slots, read with the anon key (RLS returns published
// slots only) and rendered on the server; sign-ups, Realtime and the slot drawer run on the client.
import type { Metadata } from 'next';
import { anonClient } from '../_lib/week';
import { MARSHAL_COLUMNS, type MarshalSlot } from '../_lib/club-marshal';
import { MarshallingClient } from './MarshallingClient';
import '../_components/club/club.css';

export const metadata: Metadata = { title: 'Marshalling' };
export const dynamic = 'force-dynamic';
// The database is in Ireland
export const preferredRegion = 'dub1';

export default async function BetaMarshalling() {
  let slots: MarshalSlot[] = [];
  let names: Record<string, string> = {};
  let error: string | null = null;
  const client = anonClient();
  if (!client) {
    error = 'Supabase is not configured for this deployment.';
  } else {
    const { data, error: e } = await client.from('marshal_slots').select(MARSHAL_COLUMNS).order('start_at', { ascending: true });
    if (e) {
      error = "Couldn't load the marshalling slots. Refresh to try again.";
    } else {
      slots = (data ?? []) as MarshalSlot[];
      const ids = [...new Set(slots.map((s) => s.person_id).filter((id): id is string => Boolean(id)))];
      if (ids.length) {
        const { data: people } = await client.from('members').select('id, name').in('id', ids);
        names = Object.fromEntries((people ?? []).map((p) => [p.id as string, p.name as string]));
      }
    }
  }
  return <MarshallingClient initial={slots} initialNames={names} error={error} />;
}
