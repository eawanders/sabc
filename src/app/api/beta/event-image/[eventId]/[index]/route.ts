// GET /api/beta/event-image/:eventId/:index — 302 to a fresh URL for one event image (PER-278).
// The redirect is CDN-cached well inside the signed URL's expiry (resolveEventImage), so Notion
// sees a few calls per image per hour however many people view the events pages.
import { NextResponse } from 'next/server';
import { anonClient } from '@/app/beta/_lib/week';
import { resolveEventImage } from '@/server/notion/eventImage';

// Next to the database (Supabase, Ireland)
export const preferredRegion = 'dub1';
export const dynamic = 'force-dynamic';

type Params = Promise<{ eventId: string; index: string }>;

async function loadFiles(eventId: string): Promise<unknown | undefined> {
  const client = anonClient();
  if (!client) throw new Error('Supabase is not configured');
  const { data, error } = await client.from('events').select('files').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data as { files: unknown }).files : undefined;
}

export async function GET(_req: Request, { params }: { params: Params }) {
  const { eventId, index } = await params;
  const r = await resolveEventImage(eventId, index, loadFiles);
  const headers = { 'Cache-Control': r.cacheControl };
  if (r.status === 302) return NextResponse.redirect(r.location, { status: 302, headers });
  return new NextResponse(null, { status: r.status, headers });
}
