// /beta/availability?member=<id>: weekly unavailability. The member list and this week's outings
// (for the "effect on this week" line) are read here with the anon key; the member's own ranges
// load on the client, so a slow or failed read can never be mistaken for an empty week.
import { anonClient, loadWeek, type WeekOuting } from '../_lib/week';
import type { DirectoryMember } from '../_lib/directory';
import { mondayOf } from '../_lib/time';
import { AvailabilityClient } from './AvailabilityClient';

export const dynamic = 'force-dynamic';
// The database is in Ireland
export const preferredRegion = 'dub1';

export const metadata = { title: 'Availability' };

export default async function BetaAvailability() {
  let members: DirectoryMember[] = [];
  let outings: WeekOuting[] | null = null;
  let error: string | null = null;
  const client = anonClient();
  if (!client) {
    error = 'Supabase is not configured for this deployment.';
  } else {
    const [m, w] = await Promise.allSettled([
      client.from('members').select('id, name, member_type').order('name'),
      loadWeek(client, mondayOf(new Date())),
    ]);
    if (m.status === 'fulfilled' && !m.value.error) members = (m.value.data ?? []) as DirectoryMember[];
    else error = "Couldn't load the member list. Refresh to try again.";
    // The week is only for the summary line: without it the page still works
    if (w.status === 'fulfilled') outings = w.value;
  }

  return <AvailabilityClient members={members} outings={outings} error={error} />;
}
