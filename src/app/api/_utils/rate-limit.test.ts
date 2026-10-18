import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, warn } = vi.hoisted(() => ({ rpc: vi.fn(), warn: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ rpc })) }));
vi.mock('./logger', () => ({ default: { warn, error: vi.fn(), info: vi.fn() } }));

import { checkAuthenticatedRateLimit, checkLiveWriteRateLimit, checkRateLimit, RateLimitError } from './rate-limit';

describe('rate limiter (Postgres fixed window)', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'http://127.0.0.1:1';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    rpc.mockReset();
    warn.mockReset();
  });

  it('makes one rate_limit_hit call: 30 a minute per identifier', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(checkRateLimit('live:a:203.0.113.7')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledExactlyOnceWith('rate_limit_hit', {
      p_key: 'ip:live:a:203.0.113.7',
      p_window_seconds: 60,
      p_max: 30,
    });
  });

  it('throws RateLimitError once over the limit, with the window end as reset', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-18T12:00:30Z') });
    try {
      rpc.mockResolvedValue({ data: false, error: null });
      const err = await checkRateLimit('x').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).meta).toEqual({
        limit: 30,
        remaining: 0,
        reset: new Date('2026-10-18T12:01:00Z').getTime(),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives /api/live/* writes 120 a minute under their own key', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await checkLiveWriteRateLimit('live:a:203.0.113.7');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('rate_limit_hit', {
      p_key: 'write:live:a:203.0.113.7',
      p_window_seconds: 60,
      p_max: 120,
    });
  });

  it('gives signed-in users 60 a minute under their own key', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await checkAuthenticatedRateLimit('u1');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('rate_limit_hit', { p_key: 'user:u1', p_window_seconds: 60, p_max: 60 });
  });

  it.each([
    ['a Postgres error (e.g. the migration has not landed yet)', () => rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } })],
    ['a network failure', () => rpc.mockRejectedValue(new TypeError('fetch failed'))],
  ])('fails open and logs on %s', async (_n, arrange) => {
    arrange();
    await expect(checkRateLimit('y')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ type: 'RATE_LIMITER_UNAVAILABLE' }));
  });
});
