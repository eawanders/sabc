// POST /api/live/member/add — add a guest (Non-Member) to Notion + the members table, or return
// the existing member of that name (PER-277). Body: { name, actor }. Answers
//   200 { ok: true, member: { id, name } } · 400/429/500 { ok: false, reason }
// where `reason` is a short sentence safe to show the user (no internal detail).
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/app/api/_utils/request';
import { checkRateLimit, RateLimitError } from '@/app/api/_utils/rate-limit';
import { getClientIp } from '@/app/api/_utils/response';
import logger, { logApiError } from '@/app/api/_utils/logger';
import { addGuestMemberSchema } from '@/lib/live/schemas';
import { addGuest } from '@/server/live/guestMember';

// Next to the database (Supabase, Ireland)
export const preferredRegion = 'dub1';

const ROUTE = '/api/live/member/add';
const NO_STORE = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function fail(status: number, reason: string) {
  return NextResponse.json({ ok: false, reason }, { status, headers: NO_STORE });
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = await readJsonObject(req);
  const parsed = body ? addGuestMemberSchema.safeParse(body) : null;
  if (!parsed?.success) return fail(400, 'Enter a name between 2 and 80 characters');
  const { name, actor } = parsed.data;
  const ip = getClientIp(req);

  try {
    await checkRateLimit(`live:${actor ?? 'anon'}:${ip}`);
  } catch (error) {
    if (error instanceof RateLimitError) return fail(429, 'Too many changes, try again in a moment');
    logger.warn({ type: 'RATE_LIMITER_UNAVAILABLE', route: ROUTE, error: error instanceof Error ? error.message : 'unknown' });
  }

  try {
    const { member, created } = await addGuest(name);
    logger.info({ route: ROUTE, memberId: member.id, created }, created ? 'Guest member created' : 'Guest member already existed');
    return NextResponse.json({ ok: true, member }, { status: 200, headers: NO_STORE });
  } catch (error) {
    logApiError(error, { route: ROUTE, method: 'POST', userId: actor ?? undefined, ip });
    return fail(500, 'Could not add the guest. Please try again.');
  }
}
