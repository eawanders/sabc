// /beta/week ("My week"): the signed-in member's outings this week (?week=next for next week),
// each with a three-way reply. Who is signed in lives on the device, so the list loads on the client.
import type { Metadata } from 'next';
import { addDays, mondayOf, weekRange } from '../_lib/time';
import { WeekClient } from './WeekClient';
import './week.css';

export const metadata: Metadata = { title: 'My week · Beta' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyWeekPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = sp.week === 'next';
  const monday = next ? addDays(mondayOf(new Date()), 7) : mondayOf(new Date());
  const { start, end } = weekRange(monday);
  return <WeekClient next={next} monday={monday} from={start.toISOString()} to={end.toISOString()} />;
}
