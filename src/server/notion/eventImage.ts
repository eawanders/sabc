// Event images (beta): Notion-hosted file URLs expire about an hour after Notion hands them out, so
// the synced URLs in events.files can't be shown. This resolves one image to a fresh URL: the event
// must be in the events table, the entry an image, and the page in the SABC Events data source.
// The route redirects to the URL and the CDN caches that redirect, so Notion sees a handful of
// calls per image per hour whatever the traffic.
import { eventImageCacheControl, fileEntryUrl, isImageEntry, isNotionId } from '@/app/beta/_lib/club-events';
import { notionRequest } from './client';
import { getDataSourceId } from './datasource';

const EVENTS_DATABASE_ID = '27a80040a8fa804a9f8bd536dcc548a7';
const NOT_FOUND_CACHE = 'public, max-age=0, s-maxage=300';
const ERROR_CACHE = 'no-store';

export type EventImageResult =
  | { status: 302; location: string; cacheControl: string }
  | { status: 404 | 502; cacheControl: string };

/** The event's synced Files & media, `undefined` when there is no such event; throws on a read error. */
export type LoadEventFiles = (eventId: string) => Promise<unknown | undefined>;

type NotionPageFiles = {
  parent?: { data_source_id?: string };
  properties?: Record<string, { files?: unknown }>;
};

export async function resolveEventImage(
  eventId: string,
  indexParam: string,
  loadFiles: LoadEventFiles,
  now: number = Date.now(),
): Promise<EventImageResult> {
  const notFound = { status: 404, cacheControl: NOT_FOUND_CACHE } as const;
  if (!isNotionId(eventId) || !/^\d{1,2}$/.test(indexParam)) return notFound;
  const index = Number(indexParam);

  let synced: unknown;
  try {
    synced = await loadFiles(eventId);
  } catch {
    return { status: 502, cacheControl: ERROR_CACHE };
  }
  if (!Array.isArray(synced) || !isImageEntry(synced[index])) return notFound;

  const entry = synced[index] as { type: string; file?: { expiry_time?: string } };
  // External links don't expire: no need to ask Notion
  if (entry.type === 'external') {
    return { status: 302, location: fileEntryUrl(entry)!, cacheControl: eventImageCacheControl(null, now) };
  }

  let page: NotionPageFiles;
  try {
    page = await notionRequest<NotionPageFiles>({ method: 'get', path: `pages/${eventId}` }, 'pages/:event-image');
    if (page.parent?.data_source_id !== (await getDataSourceId(EVENTS_DATABASE_ID))) return notFound;
  } catch {
    return { status: 502, cacheControl: ERROR_CACHE };
  }
  const files = page.properties?.['Files & media']?.files;
  const fresh = Array.isArray(files) ? (files[index] as { type?: string; file?: { expiry_time?: string } } | undefined) : undefined;
  // Admins may have changed the files since the sync; only a Notion-hosted image is served
  if (!fresh || fresh.type !== 'file' || !isImageEntry(fresh)) return notFound;
  return { status: 302, location: fileEntryUrl(fresh)!, cacheControl: eventImageCacheControl(fresh.file?.expiry_time, now) };
}
