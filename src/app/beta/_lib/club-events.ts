// Events (beta): rows from public.events (anon read), upcoming/past split, slugs as today's
// /events/[slug] uses them, and a safe reading of the Notion "Embedded Form" snippet.
//
// Images are deliberately not shown: events.files holds Notion file URLs that expire about an hour
// after the sync, so rendering them from the database would show broken images.
import { createSlug } from '@/lib/slug';
import { TZ, dayLabel, hhmm, londonParts, londonToUtc } from './time';

export type ClubEvent = {
  id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  embedded_form: string | null;
};

export const EVENT_COLUMNS = 'id, title, description, start_at, end_at, all_day, embedded_form';

/** Start of today in London, as an instant: today's events still count as upcoming (as today). */
export function startOfLondonDay(now: Date): Date {
  const p = londonParts(now);
  return londonToUtc(p.y, p.m, p.d);
}

/** Upcoming (start on or after today, soonest first) and past (most recent first). Undated events are left out, as today. */
export function splitEvents(events: ClubEvent[], now: Date): { upcoming: ClubEvent[]; past: ClubEvent[] } {
  const cut = startOfLondonDay(now).getTime();
  const dated = events.filter((e) => e.start_at && !Number.isNaN(Date.parse(e.start_at)));
  const upcoming = dated.filter((e) => Date.parse(e.start_at!) >= cut).sort((a, b) => Date.parse(a.start_at!) - Date.parse(b.start_at!));
  const past = dated.filter((e) => Date.parse(e.start_at!) < cut).sort((a, b) => Date.parse(b.start_at!) - Date.parse(a.start_at!));
  return { upcoming, past };
}

export function eventSlug(e: Pick<ClubEvent, 'title'>): string {
  return createSlug(e.title);
}

/** The event a slug names. Titles repeat across years, so prefer the next upcoming one, then the latest past one. */
export function findBySlug(events: ClubEvent[], slug: string, now: Date): ClubEvent | null {
  const { upcoming, past } = splitEvents(events, now);
  const undated = events.filter((e) => !e.start_at);
  return [...upcoming, ...past, ...undated].find((e) => eventSlug(e) === slug) ?? null;
}

const longDay = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "Sat 30 May" and "19:00–22:00" / "All day". */
export function eventWhen(e: Pick<ClubEvent, 'start_at' | 'end_at' | 'all_day'>): { day: string; long: string; time: string } {
  if (!e.start_at) return { day: '—', long: 'No date', time: '' };
  const start = new Date(e.start_at);
  const end = e.end_at ? new Date(e.end_at) : null;
  const time = e.all_day ? 'All day' : `${hhmm(start)}${end ? `–${hhmm(end)}` : ''}`;
  return { day: dayLabel(start), long: longDay.format(start), time };
}

/**
 * Hosts that serve (or could serve) this app. The form iframe allows scripts + same-origin, which
 * from our own origin would undo the sandbox, so these are never embedded.
 */
export function isOwnHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return (
    h === 'sabcoxford.com' ||
    h.endsWith('.sabcoxford.com') ||
    h === 'vercel.app' ||
    h.endsWith('.vercel.app') ||
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h === '127.0.0.1' ||
    h === '[::1]'
  );
}

export type EmbeddedForm = { src: string; height: number };

/**
 * The form to embed, from the Notion "Embedded Form" text. Today that text is an <iframe> snippet
 * rendered as raw HTML; here only its https src (and height) are kept and the page draws its own
 * iframe, so nothing else in the snippet can run. A bare https URL works too.
 */
export function parseEmbeddedForm(snippet: string | null | undefined): EmbeddedForm | null {
  const text = (snippet ?? '').trim();
  if (!text) return null;
  const m = /<iframe\b[^>]*?\ssrc\s*=\s*(["'])(.*?)\1/i.exec(text);
  const raw = m ? m[2] : /^https:\/\/\S+$/i.test(text) ? text : null;
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.replace(/&amp;/g, '&'));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || isOwnHost(url.hostname)) return null;
  const h = /\sheight\s*=\s*["']?(\d+)/i.exec(text);
  const height = h ? Math.min(2000, Math.max(300, Number(h[1]))) : 800;
  return { src: url.toString(), height };
}
