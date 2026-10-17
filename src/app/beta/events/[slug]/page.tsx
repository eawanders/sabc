// /beta/events/[slug]: one event, with its sign-up form. The slug is today's (createSlug(title)).
// The form is drawn from the snippet's https src only (parseEmbeddedForm), never injected as HTML.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { anonClient } from '../../_lib/week';
import { EVENT_COLUMNS, eventWhen, findBySlug, parseEmbeddedForm, type ClubEvent } from '../../_lib/club-events';
import '../../_components/club/club.css';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'dub1';

type Params = Promise<{ slug: string }>;

async function load(slug: string): Promise<{ event: ClubEvent | null; error: string | null }> {
  const client = anonClient();
  if (!client) return { event: null, error: 'Supabase is not configured for this deployment.' };
  const { data, error } = await client.from('events').select(EVENT_COLUMNS);
  if (error) return { event: null, error: "Couldn't load this event. Refresh to try again." };
  return { event: findBySlug((data ?? []) as ClubEvent[], slug, new Date()), error: null };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { event } = await load((await params).slug);
  return { title: event?.title ?? 'Event' };
}

export default async function BetaEvent({ params }: { params: Params }) {
  const { event, error } = await load((await params).slug);
  if (!error && !event) notFound();
  const when = event ? eventWhen(event) : null;
  const form = event ? parseEmbeddedForm(event.embedded_form) : null;

  return (
    <div className="b-page c-detail">
      <div className="c-crumb">
        <Link href="/beta/events">Events</Link>
        <span>/</span>
        <span>{event?.title ?? 'Not found'}</span>
      </div>
      {error && <div className="b-list b-empty">{error}</div>}
      {event && when && (
        <>
          <div className="c-card">
            <h1 style={{ fontSize: 18 }}>{event.title}</h1>
            <dl className="b-props">
              <dt>Date</dt>
              <dd>{when.long}</dd>
              <dt>Time</dt>
              <dd>{when.time || '—'}</dd>
              <dt>Sign-up</dt>
              <dd>{form ? 'Form below' : 'No sign-up form'}</dd>
            </dl>
            {event.description && <p className="c-desc">{event.description}</p>}
          </div>
          {form ? (
            <div className="c-embed" style={{ marginTop: 12 }}>
              <div className="c-embed-head">
                <span>Sign-up form</span>
                <a className="b-link" href={form.src} target="_blank" rel="noopener noreferrer">
                  Open in a new tab ↗
                </a>
              </div>
              <iframe
                src={form.src}
                height={form.height}
                title={`${event.title} sign-up form`}
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                allow="fullscreen"
              />
            </div>
          ) : (
            <p className="b-note" style={{ padding: '12px 2px' }}>
              This event does not have a sign-up form.
            </p>
          )}
        </>
      )}
    </div>
  );
}
