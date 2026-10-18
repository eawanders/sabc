// /beta/schedule: the week list (or ?view=month calendar) is rendered here on the server (anon key,
// published outings only); filters and the crew drawer run on the client.
//   ?week=YYYY-MM-DD | ?view=month&month=YYYY-MM · ?type= ?div= ?member= · ?outing=<id>&tab=report
import { anonClient } from '../_lib/week';
import { addDays, isIsoDate, mondayOf, weekRange } from '../_lib/time';
import { addMonths, isMonth, monthGrid, monthOf } from './_lib/calendar';
import { loadSchedule, type ScheduleOuting } from './_lib/load';
import { ScheduleClient } from './ScheduleClient';

export const dynamic = 'force-dynamic';
// The database is in Ireland
export const preferredRegion = 'dub1';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BetaSchedule({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const now = new Date();
  const view = sp.view === 'month' ? 'month' : 'week';
  const week = isIsoDate(sp.week) ? mondayOf(new Date(`${sp.week}T12:00:00Z`)) : mondayOf(now);
  const month = isMonth(sp.month) ? sp.month : isIsoDate(sp.week) ? monthOf(new Date(`${sp.week}T12:00:00Z`)) : monthOf(now);
  const grid = view === 'month' ? monthGrid(month) : null;
  const range = grid ?? weekRange(week);

  let outings: ScheduleOuting[] = [];
  let error: string | null = null;
  const client = anonClient();
  if (!client) {
    error = 'Supabase is not configured for this deployment.';
  } else {
    try {
      outings = await loadSchedule(client, range.start, range.end);
    } catch {
      error = `Couldn't load this ${view}. Refresh to try again.`;
    }
  }

  return (
    <ScheduleClient
      view={view}
      week={week}
      prevWeek={addDays(week, -7)}
      nextWeek={addDays(week, 7)}
      thisWeek={mondayOf(now)}
      month={month}
      prevMonth={addMonths(month, -1)}
      nextMonth={addMonths(month, 1)}
      thisMonth={monthOf(now)}
      gridDays={grid?.days ?? []}
      outings={outings}
      error={error}
    />
  );
}
