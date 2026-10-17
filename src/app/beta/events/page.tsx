// /beta/events (?past=1): club events from the events table (anon read), upcoming first.
// No images: the stored Notion file URLs expire about an hour after each sync.
import type { Metadata } from 'next';
import Link from 'next/link';
import { anonClient } from '../_lib/week';
import { EVENT_COLUMNS, eventSlug, eventWhen, parseEmbeddedForm, splitEvents, type ClubEvent } from '../_lib/club-events';
import '../_components/club/club.css';

export const metadata: Metadata = { title: 'Events' };
export const dynamic = 'force-dynamic';
export const preferredRegion = 'dub1';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BetaEvents({ searchParams }: { searchParams: SearchParams }) {
  const past = (await searchParams).past === '1';
  let events: ClubEvent[] = [];
  let error: string | null = null;
  const client = anonClient();
  if (!client) error = 'Supabase is not configured for this deployment.';
  else {
    const { data, error: e } = await client.from('events').select(EVENT_COLUMNS);
    if (e) error = "Couldn't load events. Refresh to try again.";
    else events = (data ?? []) as ClubEvent[];
  }
  const split = splitEvents(events, new Date());
  const list = past ? split.past : split.upcoming;

  return (
    <div className="b-page">
      <header className="b-top">
        <div>
          <h1>
            Events<span className="b-tag">Beta</span>
          </h1>
          <div className="sub">Socials, dinners and club sessions. Sign up where there&apos;s a form.</div>
        </div>
        <nav className="c-tabs" aria-label="Which events">
          <Link href="/beta/events" aria-current={past ? undefined : 'page'}>
            Upcoming
          </Link>
          <Link href="/beta/events?past=1" aria-current={past ? 'page' : undefined}>
            Past
          </Link>
        </nav>
      </header>
      <div className="b-list">
        {error && <div className="b-empty">{error}</div>}
        {!error && list.length === 0 && <div className="b-empty">{past ? 'No past events.' : 'No upcoming events.'}</div>}
        {list.map((e) => {
          const when = eventWhen(e);
          const form = parseEmbeddedForm(e.embedded_form);
          return (
            <Link key={e.id} href={`/beta/events/${eventSlug(e)}`} className="c-erow">
              <span className="day">{when.day}</span>
              <span className="b-mono tm">{when.time}</span>
              <span style={{ minWidth: 0 }}>
                <span className="ti">{e.title}</span>
                {e.description && <span className="de">{e.description}</span>}
              </span>
              <span>{form && !past ? <span className="b-btn c-sm">Sign up</span> : null}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
