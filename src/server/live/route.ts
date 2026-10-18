// src/server/live/route.ts
// One handler for every /api/live/* write: parse + validate the body, rate-limit per actor + IP,
// call the RPC, and answer with a LiveResult and a matching status code:
//   200 ok · 400 invalid · 403 forbidden (undo of someone else's change) · 404 not_found
//   409 conflict (with who holds it now) · 429 rate_limited · 500 error (no internal detail)
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { readJsonObject } from '@/app/api/_utils/request';
import { checkLiveWriteRateLimit, RateLimitError } from '@/app/api/_utils/rate-limit';
import { getClientIp } from '@/app/api/_utils/response';
import logger, { logApiError } from '@/app/api/_utils/logger';
import type { LiveResult } from '@/lib/live/types';
import { callLiveRpc, type LiveRpc } from './client';
import { getFlagStatusText } from './flagStatus';

const STATUS_BY_REASON: Record<string, number> = {
  invalid: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  error: 500,
};

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function respond(result: LiveResult<unknown>, extra?: Record<string, unknown>): NextResponse {
  const status = result.ok ? 200 : STATUS_BY_REASON[result.reason] ?? 500;
  return NextResponse.json({ ...result, ...extra }, { status, headers: NO_STORE });
}

type RpcCall = { fn: LiveRpc; args: Record<string, unknown> };
type Ctx = { flagStatus: () => Promise<string | null> };

export function liveRoute<S extends z.ZodType<{ actorId: string }>>(
  name: string,
  schema: S,
  toRpc: (input: z.output<S>, ctx: Ctx) => RpcCall | Promise<RpcCall>,
) {
  const route = `/api/live/${name}`;
  return async function POST(req: Request): Promise<NextResponse> {
    const body = await readJsonObject(req);
    if (!body) return respond({ ok: false, reason: 'invalid', message: 'Invalid JSON body' });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return respond(
        { ok: false, reason: 'invalid', message: 'Validation failed' },
        { issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      );
    }
    const input = parsed.data;
    const ip = getClientIp(req);

    // Per actor + IP. A limiter outage must not block writes: log it and carry on.
    try {
      await checkLiveWriteRateLimit(`live:${input.actorId}:${ip}`);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return respond({ ok: false, reason: 'rate_limited', message: 'Too many changes, try again in a moment' });
      }
      logger.warn({ type: 'RATE_LIMITER_UNAVAILABLE', route, error: error instanceof Error ? error.message : 'unknown' });
    }

    try {
      const { fn, args } = await toRpc(input, { flagStatus: getFlagStatusText });
      return respond(await callLiveRpc(fn, args));
    } catch (error) {
      logApiError(error, { route, method: 'POST', userId: input.actorId, ip });
      return respond({ ok: false, reason: 'error', message: 'Something went wrong. Please try again.' });
    }
  };
}
