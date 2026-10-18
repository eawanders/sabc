// /beta: Home. Club sections are read on the server with the anon key (first paint has real data);
// "Your next outings" depends on who this device is signed in as, so it loads on the client.
import Link from 'next/link';
import { getFlagStatusText } from '@/server/live/flagStatus';
import { createSlug } from '@/lib/slug';
import { Status } from './_components/CrewDrawer';
import { flagLabel, loadHome, whenLabel, type HomeData, type Section } from './_lib/home-data';
import { flagTone, outingStatusTone } from './_lib/seats';
import { hhmm, londonParts, mondayOf, shortDay } from './_lib/time';
import { anonClient } from './_lib/week';
import { YourNextOutings } from './_home/YourNextOutings';
import './week/week.css';
import './_home/home.css';

export const dynamic = 'force-dynamic';
// The database is in Ireland
export const preferredRegion = 'dub1';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FIT_TEXT = { free: 'Free', partial: 'Partly free', blocked: 'Unavailable' } as const;
const FIT_TONE = { free: 'ok', partial: 'maybe', blocked: 'unk' } as const;

function outingHref(id: string, startIso: string) {
  return `/beta/schedule?week=${mondayOf(new Date(startIso))}&outing=${id}`;
}

/** "Today", "Tomorrow" or "Mon 19", in London. */
function dayWord(iso: string, now: Date): string {
  const d = new Date(iso);
  const p = londonParts(d);
  const key = (x: { y: number; m: number; d: number }) => `${x.y}-${x.m}-${x.d}`;
  if (key(p) === key(londonParts(now))) return 'Today';
  if (key(p) === key(londonParts(new Date(now.getTime() + 864e5)))) return 'Tomorrow';
  return `${shortDay(d)} ${p.d}`;
}

function Head({ id, title, href, more }: { id: string; title: string; href: string; more: string }) {
  return (
    <header className="h-head">
      <h2 id={id}>{title}</h2>
      <Link className="h-more" href={href}>
        {more}
      </Link>
    </header>
  );
}

function Body<T>({ section, empty, children }: { section: Section<T>; empty: (d: T) => string | null; children: (d: T) => React.ReactNode }) {
  if (section.error !== null) return <div className="h-empty">{section.error} Refresh to try again.</div>;
  const e = empty(section.data);
  return e ? <div className="h-empty">{e}</div> : <>{children(section.data)}</>;
}

export default async function BetaHome() {
  const now = new Date();
  const client = anonClient();
  const [data, flag] = await Promise.all([
    client ? loadHome(client, now) : Promise.resolve(null),
    getFlagStatusText().catch(() => null),
  ]);
  const notConfigured: Section<never> = { data: null, error: 'Supabase is not configured for this deployment.' };
  const d: HomeData = data ?? { sessions: notConfigured, recent: notConfigured, coxes: notConfigured, tests: notConfigured, nextEvent: notConfigured };
  const today = DAY_NAMES.findIndex((n) => n.toLowerCase() === londonParts(now).weekday);
  const flagText = flagLabel(flag);

  return (
    <div className="b-page h-page">
      <header className="b-top">
        <div>
          <h1>
            Home<span className="b-tag">Beta</span>
          </h1>
          <div className="sub">St Antony&apos;s College Boat Club · sign up for outings, coxing and OURC tests; see reports and events.</div>
        </div>
      </header>

      <div className="h-grid">
        <div className="h-col">
          <YourNextOutings />

          <section className="h-sec" aria-labelledby="h-sessions">
            <Head id="h-sessions" title="Upcoming sessions" href="/beta/schedule" more="Schedule" />
            <div className="b-list">
              <Body section={d.sessions} empty={(s) => (s.length ? null : 'No upcoming sessions.')}>
                {(sessions) =>
                  sessions.map((o) => (
                    <Link key={o.id} className="h-row h-session" href={outingHref(o.id, o.start_at)}>
                      <span className="b-mono h-when">
                        <span className={dayWord(o.start_at, now) === 'Today' ? 'h-today' : undefined}>{dayWord(o.start_at, now)}</span>{' '}
                        {hhmm(new Date(o.start_at))}
                      </span>
                      <span className="h-nm">{o.name || 'Outing'}</span>
                      <span className="h-ty">{o.type ?? ''}</span>
                      <span className="h-cn" title="Crew seated">
                        {o.crewFilled}/9
                      </span>
                      <span title={o.status ?? 'Unknown'} aria-label={o.status ?? 'Unknown status'}>
                        <Status tone={outingStatusTone(o.status)} text="" />
                      </span>
                    </Link>
                  ))
                }
              </Body>
            </div>
          </section>

          <section className="h-sec" aria-labelledby="h-recent">
            <Head id="h-recent" title="Recent water outings" href="/beta/schedule" more="Schedule" />
            <div className="b-list">
              <Body section={d.recent} empty={(r) => (r.length ? null : 'No recent water outings.')}>
                {(recent) =>
                  recent.map((o) => (
                    <Link key={o.id} className="h-row h-recent" href={outingHref(o.id, o.start_at)}>
                      <span className="b-mono h-when">
                        {dayWord(o.start_at, now)} {hhmm(new Date(o.start_at))}
                      </span>
                      <span className="h-nm">{o.name || 'Outing'}</span>
                      <span className={o.hasReport ? 'h-rep' : 'h-rep b-muted'}>{o.hasReport ? 'Report' : 'No report yet'}</span>
                    </Link>
                  ))
                }
              </Body>
            </div>
          </section>
        </div>

        <div className="h-col">
          <section className="h-sec" aria-labelledby="h-flag">
            <Head id="h-flag" title="River flag" href="/beta/flag" more="Flag status" />
            <div className="b-list">
              <Link className="h-row h-flag" href="/beta/flag">
                <Status tone={flagTone(flag)} text={flagText ?? 'Flag unavailable'} />
                <span className="b-muted">Isis · OURCS</span>
              </Link>
            </div>
          </section>

          <section className="h-sec" aria-labelledby="h-cox">
            <Head id="h-cox" title="Coxes this week" href="/beta/availability" more="Availability" />
            <div className="b-list">
              <Body section={d.coxes} empty={(c) => (c.length ? null : 'No coxes available this week.')}>
                {(coxes) => (
                  <table className="h-cox">
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="h-sr">Cox</span>
                        </th>
                        {DAYS.map((day, i) => (
                          <th key={i} scope="col" className={i === today ? 'h-today' : undefined} title={DAY_NAMES[i]}>
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {coxes.map((c) => (
                        <tr key={c.id}>
                          <th scope="row">{c.name}</th>
                          {c.days.map((fit, i) => (
                            <td key={i} className={i === today ? 'h-today' : undefined} title={`${DAY_NAMES[i]}: ${FIT_TEXT[fit]}`}>
                              <span className={`b-dot ${FIT_TONE[fit]}`} aria-label={`${DAY_NAMES[i]}: ${FIT_TEXT[fit]}`} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Body>
            </div>
          </section>

          <section className="h-sec" aria-labelledby="h-tests">
            <Head id="h-tests" title="Upcoming swim tests" href="/beta/tests" more="Swim tests" />
            <div className="b-list">
              <Body section={d.tests} empty={(t) => (t.length ? null : 'No upcoming tests.')}>
                {(tests) =>
                  tests.map((t) => (
                    <Link key={t.id} className="h-row h-test" href="/beta/tests">
                      <span className="b-mono h-when">
                        {dayWord(t.start_at, now)} {hhmm(new Date(t.start_at))}
                      </span>
                      <span className="h-nm">{t.title}</span>
                      <span className="h-cn">{t.full ? 'Full' : `${t.booked}/${t.slots}`}</span>
                    </Link>
                  ))
                }
              </Body>
            </div>
          </section>

          <section className="h-sec" aria-labelledby="h-event">
            <Head id="h-event" title="Next event" href="/beta/events" more="Events" />
            <div className="b-list">
              <Body section={d.nextEvent} empty={(e) => (e ? null : 'No upcoming events.')}>
                {(e) =>
                  e && (
                    <div className="h-row h-event">
                      <Link href="/beta/events" className="h-nm">
                        <b>{e.title}</b>
                        <span className="b-muted">{whenLabel(e.start_at, e.all_day)}</span>
                      </Link>
                      {e.hasForm && (
                        <Link className="b-btn" href={`/events/${createSlug(e.title)}`}>
                          Sign up
                        </Link>
                      )}
                    </div>
                  )
                }
              </Body>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
