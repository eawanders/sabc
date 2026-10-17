import { beforeEach, describe, expect, it, vi } from 'vitest';

const { notionRequest, checkRateLimit, db } = vi.hoisted(() => {
  const db = {
    existing: [] as { id: string; name: string }[],
    lookupError: null as { message: string } | null,
    upsertError: null as { message: string } | null,
    ilike: vi.fn(),
    upsert: vi.fn(),
  };
  return { notionRequest: vi.fn(), checkRateLimit: vi.fn(), db };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        ilike: (col: string, pattern: string) => {
          db.ilike(col, pattern);
          return { limit: async () => ({ data: db.existing, error: db.lookupError }) };
        },
      }),
      upsert: async (row: unknown, opts: unknown) => {
        db.upsert(row, opts);
        return { error: db.upsertError };
      },
    }),
  })),
}));
vi.mock('@/server/notion/client', () => ({ getNotionClient: () => ({ request: notionRequest }) }));
vi.mock('@/app/api/_utils/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/api/_utils/rate-limit')>()),
  checkRateLimit,
}));
vi.mock('@/app/api/_utils/logger', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  logApiError: vi.fn(),
}));

import { RateLimitError } from '@/app/api/_utils/rate-limit';
import { logApiError } from '@/app/api/_utils/logger';
import { addGuestMember } from '@/lib/live/members';
import { POST } from './route';

const ADA = 'aaaaaaaa-0000-4000-8000-000000000001';
const NEW_PAGE = 'BBBBBBBB00004000800000000000000F'; // Notion may answer any case / unhyphenated

function post(body: unknown, raw = false) {
  return POST(
    new Request('http://localhost/api/live/member/add', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.7' },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
  );
}

describe('POST /api/live/member/add', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'http://127.0.0.1:1';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    db.existing = [];
    db.lookupError = null;
    db.upsertError = null;
    db.ilike.mockReset();
    db.upsert.mockReset();
    notionRequest.mockReset();
    notionRequest.mockResolvedValue({ id: NEW_PAGE });
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue(undefined);
    vi.mocked(logApiError).mockClear();
  });

  it.each([
    ['invalid JSON', '{nope', true],
    ['a one-letter name', { name: ' A ', actor: null }],
    ['an 81-character name', { name: 'x'.repeat(81), actor: null }],
    ['a missing actor key', { name: 'Ada Guest' }],
    ['a malformed actor', { name: 'Ada Guest', actor: 'bob' }],
    ['an extra key', { name: 'Ada Guest', actor: null, memberType: 'Coach' }],
  ])('rejects %s with 400 and writes nothing', async (_n, body, raw = false) => {
    const res = await post(body, raw as boolean);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, reason: expect.any(String) });
    expect(notionRequest).not.toHaveBeenCalled();
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it('returns the existing member of the same name (case and spacing ignored) without creating one', async () => {
    db.existing = [
      { id: 'cccccccc-0000-4000-8000-000000000003', name: 'Ada Guestworth' },
      { id: ADA, name: 'ada  guest' },
    ];
    const res = await post({ name: '  Ada   Guest ', actor: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, member: { id: ADA, name: 'ada  guest' } });
    expect(db.ilike).toHaveBeenCalledWith('name', 'ada%guest');
    expect(notionRequest).not.toHaveBeenCalled();
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it('escapes LIKE wildcards in the lookup', async () => {
    await post({ name: '100% G_uest', actor: null });
    expect(db.ilike).toHaveBeenCalledWith('name', '100\\%%g\\_uest');
  });

  it('creates the Notion page as a Non-Member and upserts the row once, with the canonical id', async () => {
    const res = await post({ name: ' Grace  Hopper ', actor: ADA });
    expect(res.status).toBe(200);
    const id = 'bbbbbbbb-0000-4000-8000-00000000000f';
    expect(await res.json()).toEqual({ ok: true, member: { id, name: 'Grace Hopper' } });

    expect(notionRequest).toHaveBeenCalledTimes(1);
    const call = notionRequest.mock.calls[0][0];
    expect(call).toMatchObject({ method: 'post', path: 'pages' });
    expect(call.body.parent).toEqual({ type: 'data_source_id', data_source_id: '23d80040-a8fa-80cc-8b43-000ba4901edf' });
    expect(call.body.properties).toEqual({
      'Full Name': { title: [{ text: { content: 'Grace Hopper' } }] },
      'Member Type': { multi_select: [{ name: 'Non-Member' }] },
    });
    expect(call.body.properties).not.toHaveProperty('College');

    expect(db.upsert).toHaveBeenCalledTimes(1);
    expect(db.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id, name: 'Grace Hopper', member_type: ['Non-Member'] }),
      { onConflict: 'id' },
    );
    expect(checkRateLimit).toHaveBeenCalledWith(`live:${ADA}:203.0.113.7`);
  });

  it('rate-limits anonymous adders by IP', async () => {
    checkRateLimit.mockRejectedValue(new RateLimitError('x', { limit: 30, reset: 0, remaining: 0 }));
    const res = await post({ name: 'Grace Hopper', actor: null });
    expect(res.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('live:anon:203.0.113.7');
    expect(notionRequest).not.toHaveBeenCalled();
  });

  it('fails open when the rate limiter is down', async () => {
    checkRateLimit.mockRejectedValue(new Error('Upstash unreachable'));
    expect((await post({ name: 'Grace Hopper', actor: null })).status).toBe(200);
  });

  it('answers a generic 500 when Notion fails, logs it, and upserts nothing', async () => {
    notionRequest.mockRejectedValue(Object.assign(new Error('validation_error: Member Type is not a property'), { code: 'validation_error' }));
    const res = await post({ name: 'Grace Hopper', actor: ADA });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/validation_error|Member Type/);
    expect(JSON.parse(text)).toEqual({ ok: false, reason: 'Could not add the guest. Please try again.' });
    expect(db.upsert).not.toHaveBeenCalled();
    expect(logApiError).toHaveBeenCalled();
  });

  it('answers a generic 500 when the database upsert fails', async () => {
    db.upsertError = { message: 'violates check constraint' };
    const res = await post({ name: 'Grace Hopper', actor: ADA });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toMatch(/constraint/);
  });

  it('answers a generic 500 when the lookup fails, before touching Notion', async () => {
    db.lookupError = { message: 'permission denied' };
    const res = await post({ name: 'Grace Hopper', actor: ADA });
    expect(res.status).toBe(500);
    expect(notionRequest).not.toHaveBeenCalled();
  });
});

describe('addGuestMember (browser helper)', () => {
  it('posts { name, actor } and returns the member', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, member: { id: ADA, name: 'Ada' } })));
    expect(await addGuestMember({ name: 'Ada', actor: null }, fetchImpl as unknown as typeof fetch)).toEqual({
      ok: true, member: { id: ADA, name: 'Ada' },
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/live/member/add', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ name: 'Ada', actor: null }),
    }));
  });

  it('passes the server reason through and never throws', async () => {
    const bad = vi.fn(async () => new Response(JSON.stringify({ ok: false, reason: 'Enter a name' }), { status: 400 }));
    expect(await addGuestMember({ name: '', actor: null }, bad as unknown as typeof fetch)).toEqual({ ok: false, reason: 'Enter a name' });
    const down = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await addGuestMember({ name: 'Ada', actor: null }, down as unknown as typeof fetch)).toMatchObject({ ok: false });
    const html = vi.fn(async () => new Response('<html>', { status: 429 }));
    expect(await addGuestMember({ name: 'Ada', actor: null }, html as unknown as typeof fetch)).toMatchObject({ ok: false, reason: expect.stringMatching(/Too many/) });
  });
});
