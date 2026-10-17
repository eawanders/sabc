// /beta/schedule?week=YYYY-MM-DD&outing=<id>: the week list is rendered here on the server (anon key,
// published outings only); the crew drawer for ?outing= opens and loads on the client.
import { anonClient, loadWeek, type WeekOuting } from '../_lib/week';
import { addDays, isIsoDate, mondayOf } from '../_lib/time';
import { ScheduleClient } from './ScheduleClient';

export const dynamic = 'force-dynamic';
// The database is in Ireland
export const preferredRegion = 'dub1';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BetaSchedule({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const week = isIsoDate(sp.week) ? mondayOf(new Date(`${sp.week}T12:00:00Z`)) : mondayOf(new Date());

  let outings: WeekOuting[] = [];
  let error: string | null = null;
  const client = anonClient();
  if (!client) {
    error = 'Supabase is not configured for this deployment.';
  } else {
    try {
      outings = await loadWeek(client, week);
    } catch {
      error = "Couldn't load this week. Refresh to try again.";
    }
  }

  return (
    <ScheduleClient
      week={week}
      prevWeek={addDays(week, -7)}
      nextWeek={addDays(week, 7)}
      thisWeek={mondayOf(new Date())}
      outings={outings}
      error={error}
    />
  );
}
