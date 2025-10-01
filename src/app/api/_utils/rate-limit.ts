import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client (only if credentials are available)
let redis: Redis | null = null;
let limiter: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  // 30 requests per minute per IP
  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'sabc:ratelimit',
  });
}

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

/**
 * Check rate limit for an identifier (IP address or user ID)
 * @throws {RateLimitError} if rate limit is exceeded
 */
export async function checkRateLimit(identifier: string): Promise<void> {
  // If rate limiting is not configured, allow the request
  if (!limiter) {
    console.warn('Rate limiting not configured - UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN missing');
    return;
  }

  const { success, limit, reset, remaining } = await limiter.limit(`ip:${identifier}`);

  if (!success) {
    throw new RateLimitError('Rate limit exceeded', { limit, reset, remaining });
  }
}

/**
 * Check rate limit for authenticated users (higher limits)
 */
export async function checkAuthenticatedRateLimit(userId: string): Promise<void> {
  if (!limiter) {
    return;
  }

  // Authenticated users get higher limits: 60 requests per minute
  const authenticatedLimiter = new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: true,
    prefix: 'sabc:ratelimit:auth',
  });

  const { success, limit, reset, remaining } = await authenticatedLimiter.limit(`user:${userId}`);

  if (!success) {
    throw new RateLimitError('Rate limit exceeded', { limit, reset, remaining });
  }
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
