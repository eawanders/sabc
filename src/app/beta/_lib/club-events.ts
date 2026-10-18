// Events (beta): rows from public.events (anon read), upcoming/past split, slugs as today's
// /events/[slug] uses them, and a safe reading of the Notion "Embedded Form" snippet.
//
// Images: events.files holds Notion "Files & media" as synced, whose Notion-hosted URLs expire
// about an hour later. Pages never use those URLs; they point <img> at /api/beta/event-image,
// which redirects to a fresh signed URL and lets the CDN cache that redirect (eventImageCacheControl).
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
  /** Notion "Files & media" entries as synced (jsonb). */
  files: unknown;
};

export const EVENT_COLUMNS = 'id, title, description, start_at, end_at, all_day, embedded_form, files';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;

/** The https URL of a Files & media entry (Notion-hosted or external), or null. */
export function fileEntryUrl(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as { type?: unknown; file?: { url?: unknown }; external?: { url?: unknown } };
  const url = e.type === 'file' ? e.file?.url : e.type === 'external' ? e.external?.url : null;
  if (typeof url !== 'string') return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** Whether a Files & media entry is an image we can show (by its file name or URL path). */
export function isImageEntry(entry: unknown): boolean {
  const url = fileEntryUrl(entry);
  if (!url) return false;
  const name = (entry as { name?: unknown }).name;
  return (typeof name === 'string' && IMAGE_EXT.test(name.trim())) || IMAGE_EXT.test(new URL(url).pathname);
}

/** Positions of the image entries in Files & media (an event can also hold links, e.g. a form). */
export function eventImageIndexes(files: unknown): number[] {
  if (!Array.isArray(files)) return [];
  return files.flatMap((f, i) => (isImageEntry(f) ? [i] : []));
}

/** A Notion page id as events.id stores it (lower-case, hyphenated). */
export function isNotionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}

export function eventImageUrl(eventId: string, index: number): string {
  return `/api/beta/event-image/${eventId}/${index}`;
}

const IMAGE_CDN_S = 2700; // 45 min, of a Notion URL's hour
const IMAGE_EXTRA_S = 300; // stale-while-revalidate, and the browser's own max-age
const IMAGE_MARGIN_S = 600;

/**
 * Cache-Control for the image redirect, so a cached redirect never outlives its signed URL:
 * CDN age + stale + browser age stays at least 10 minutes inside the URL's expiry. `expiry` is the
 * Notion file's expiry_time; null for an external URL (no expiry); undefined when unknown.
 */
export function eventImageCacheControl(expiry: string | null | undefined, now: number): string {
  const cc = (maxAge: number, sMax: number, swr: number) => `public, max-age=${maxAge}, s-maxage=${sMax}, stale-while-revalidate=${swr}`;
  if (expiry === null) return cc(IMAGE_EXTRA_S, IMAGE_CDN_S, IMAGE_EXTRA_S);
  const at = expiry === undefined ? NaN : Date.parse(expiry);
  if (Number.isNaN(at)) return cc(0, 60, 0);
  const left = Math.floor((at - now) / 1000);
  if (left >= IMAGE_CDN_S + 2 * IMAGE_EXTRA_S) return cc(IMAGE_EXTRA_S, IMAGE_CDN_S, IMAGE_EXTRA_S);
  return cc(0, Math.max(0, left - IMAGE_MARGIN_S), 0);
}

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

/** Form services an event may embed. Exact hosts, plus any subdomain of the suffix hosts. */
const FORM_HOSTS = new Set([
  'docs.google.com',
  'forms.gle',
  'forms.office.com',
  'notion.so',
  'www.notion.so',
  'tally.so',
  'typeform.com',
  'jotform.com',
  'form.jotform.com',
]);
const FORM_HOST_SUFFIXES = ['.notion.site', '.typeform.com'];

export function isFormHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return FORM_HOSTS.has(h) || FORM_HOST_SUFFIXES.some((s) => h.endsWith(s) && h.length > s.length);
}

export type EmbeddedForm = { src: string; height: number };

/**
 * The form to embed, from the Notion "Embedded Form" text. Today that text is an <iframe> snippet
 * rendered as raw HTML; here only its https src (and height) are kept and the page draws its own
 * iframe, so nothing else in the snippet can run. A bare https URL works too. Only known form
 * services (isFormHost) are embedded; the own-host block stays as defence in depth.
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
  if (url.protocol !== 'https:' || isOwnHost(url.hostname) || !isFormHost(url.hostname)) return null;
  const h = /\sheight\s*=\s*["']?(\d+)/i.exec(text);
  const height = h ? Math.min(2000, Math.max(300, Number(h[1]))) : 800;
  return { src: url.toString(), height };
}
