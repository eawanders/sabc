// Rate limiting backed by Postgres (PER-278): a fixed-window counter per key, bumped by the
// rate_limit_hit RPC (supabase/migrations/20261018700300_rate_limit.sql) in one call per request.
// If the call fails (database unreachable, or the migration not applied yet) the request is
// allowed and the failure logged: a limiter outage must never block the club's writes.
import { getServiceClient } from '@/server/live/client';
import logger from './logger';

const WINDOW_SECONDS = 60;

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly meta: {
      limit: number;
      reset: number;
      remaining: number;
    }
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

async function hit(key: string, max: number): Promise<void> {
  let allowed: boolean;
  try {
    const { data, error } = await getServiceClient().rpc('rate_limit_hit', {
      p_key: key,
      p_window_seconds: WINDOW_SECONDS,
      p_max: max,
    });
    if (error) throw new Error(error.message);
    allowed = data !== false;
  } catch (error) {
    logger.warn({ type: 'RATE_LIMITER_UNAVAILABLE', error: error instanceof Error ? error.message : 'unknown' });
    return;
  }
  if (!allowed) {
    const windowMs = WINDOW_SECONDS * 1000;
    const reset = (Math.floor(Date.now() / windowMs) + 1) * windowMs;
    throw new RateLimitError('Rate limit exceeded', { limit: max, reset, remaining: 0 });
  }
}

/**
 * Check rate limit for an identifier (IP address or user ID): 30 requests per minute
 * @throws {RateLimitError} if rate limit is exceeded
 */
export async function checkRateLimit(identifier: string): Promise<void> {
  await hit(`ip:${identifier}`, 30);
}

/**
 * Check rate limit for /api/live/* writes (seats, slots, availability, reports, undo): 120 per
 * minute, counted separately from checkRateLimit. Guest/member adds stay on checkRateLimit (30),
 * since each creates a Notion page.
 */
export async function checkLiveWriteRateLimit(identifier: string): Promise<void> {
  await hit(`write:${identifier}`, 120);
}

/**
 * Check rate limit for authenticated users (higher limits): 60 requests per minute
 */
export async function checkAuthenticatedRateLimit(userId: string): Promise<void> {
  await hit(`user:${userId}`, 60);
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  reset: number;
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  };
}
