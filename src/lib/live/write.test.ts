import { describe, expect, it, vi } from 'vitest';
import { liveWrite } from './write';
import { toCanonicalId, toDbSeat } from './schemas';

describe('liveWrite', () => {
  it('returns the route\'s LiveResult, conflicts included', async () => {
    const body = { ok: false, reason: 'conflict', current: null, holderName: 'Ada', updatedByName: 'Ada' };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status: 409 }));
    const result = await liveWrite('seat/claim', { a: 1 }, fetchImpl as unknown as typeof fetch);
    expect(result).toEqual(body);
    expect(fetchImpl).toHaveBeenCalledWith('/api/live/seat/claim', expect.objectContaining({ method: 'POST', body: '{"a":1}' }));
  });

  it('never throws on a network failure', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await liveWrite('undo', {}, fetchImpl as unknown as typeof fetch)).toEqual({
      ok: false, reason: 'error', message: 'Could not reach the server',
    });
  });

  it('maps a non-JSON 429 (e.g. from the platform) to rate_limited', async () => {
    const fetchImpl = vi.fn(async () => new Response('Too Many Requests', { status: 429 }));
    expect(await liveWrite('undo', {}, fetchImpl as unknown as typeof fetch)).toEqual({ ok: false, reason: 'rate_limited' });
  });
});

describe('id and seat mapping', () => {
  it('canonicalises Notion ids to the database form', () => {
    expect(toCanonicalId('0123456789ABCDEF0123456789ABCDEF')).toBe('01234567-89ab-cdef-0123-456789abcdef');
    expect(toCanonicalId('01234567-89AB-cdef-0123-456789abcdef')).toBe('01234567-89ab-cdef-0123-456789abcdef');
  });

  it('maps drawer seat names to Notion relation names', () => {
    expect(toDbSeat('Sub1')).toBe('Sub 1');
    expect(toDbSeat('Sub 4')).toBe('Sub 4');
    expect(toDbSeat('Coach/Bank Rider')).toBe('Coach/Bank Rider');
    expect(toDbSeat('constructor')).toBeUndefined();
    expect(toDbSeat('8 Seat')).toBeUndefined();
  });
});
