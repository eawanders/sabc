// Integration test against a LOCAL Supabase stack (never CI, never the live project).
// Reads marshal slots as /beta/marshalling does (anon key), then signs up and clears through the
// real /api/live/marshal-slot/claim handler, undoes, and races two sign-ups: exactly one wins.
//
//   supabase start            # seed.sql provides the slots and members used here
//   BETA_IT_SUPABASE_URL=http://127.0.0.1:55321 \
//   BETA_IT_ANON_KEY=... BETA_IT_SERVICE_ROLE_KEY=... \
//   npx vitest run src/app/beta/_lib/club.integration.test.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MARSHAL_COLUMNS, groupSlots, type MarshalSlot } from './club-marshal';
import { EVENT_COLUMNS, splitEvents, type ClubEvent } from './club-events';

vi.mock('@/server/live/flagStatus', () => ({ getFlagStatusText: vi.fn(async () => 'Green') }));
// These drive many writes as one actor; the limiter has its own tests (rate-limit.test.ts, 17_rate_limit)
vi.mock('@/app/api/_utils/rate-limit', async (orig) => ({ ...(await orig<object>()), checkRateLimit: vi.fn(async () => {}), checkLiveWriteRateLimit: vi.fn(async () => {}) }));

const url = process.env.BETA_IT_SUPABASE_URL;
const anonKey = process.env.BETA_IT_ANON_KEY;
const serviceKey = process.env.BETA_IT_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url ?? ''));

const SLOT = '00000000-0000-4000-8000-000000000402'; // seed.sql: 'Wed U1 Umpire', open, published
const ADA = '00000000-0000-4000-8000-000000000001';
const DEV = '00000000-0000-4000-8000-000000000004';
const EVE = '00000000-0000-4000-8000-000000000005';
const ROUNDS = 20;

describe.skipIf(!enabled)('beta marshalling against local Supabase', () => {
  let anon: SupabaseClient;
  let service: SupabaseClient;
  let claim: (req: Request) => Promise<Response>;
  let undo: (req: Request) => Promise<Response>;
  let ip = 0;

  // A distinct IP per request keeps the per-actor+IP rate limiter out of the race
  const post = (handler: (req: Request) => Promise<Response>, body: object) =>
    handler(
      new Request('http://localhost/api/live/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.${Math.floor(++ip / 250)}.${ip % 250}` },
        body: JSON.stringify(body),
      }),
    );
  const read = async () =>
    (await anon.from('marshal_slots').select(MARSHAL_COLUMNS).eq('id', SLOT).single()).data as unknown as MarshalSlot;
  const clear = async () => {
    const s = await read();
    if (s.person_id) {
      const res = await post(claim, { slotId: SLOT, memberId: null, actorId: ADA, expectedVersion: s.version });
      expect(res.status).toBe(200);
    }
  };

  beforeAll(async () => {
    process.env.SUPABASE_URL = url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    service = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    ({ POST: claim } = await import('@/app/api/live/marshal-slot/claim/route'));
    ({ POST: undo } = await import('@/app/api/live/undo/route'));
    await clear();
  });

  afterAll(async () => {
    await clear();
  });

  it('anon reads published slots only, and they group by event / day / shift', async () => {
    const HIDDEN = '00000000-0000-4000-8000-000000000499';
    await service.from('marshal_slots').upsert({ id: HIDDEN, name: 'Hidden slot', publish: false });
    try {
      const { data } = await anon.from('marshal_slots').select(MARSHAL_COLUMNS);
      const slots = (data ?? []) as unknown as MarshalSlot[];
      expect(slots.map((s) => s.id)).toContain(SLOT);
      expect(slots.map((s) => s.id)).not.toContain(HIDDEN);
      const groups = groupSlots(slots);
      expect(groups.flatMap((g) => g.days.flatMap((d) => d.shifts.flatMap((s) => s.slots))).length).toBe(slots.length);
    } finally {
      await service.from('marshal_slots').delete().eq('id', HIDDEN);
    }
  });

  it('anon reads events', async () => {
    const { data, error } = await anon.from('events').select(EVENT_COLUMNS);
    expect(error).toBeNull();
    expect(splitEvents((data ?? []) as ClubEvent[], new Date()).upcoming.map((e) => e.title)).toContain('Club dinner');
  });

  it('signs up (Confirmed), conflicts on a stale version, undoes, clears (Open)', async () => {
    const before = await read();
    expect(before.person_id).toBeNull();

    const res = await post(claim, { slotId: SLOT, memberId: DEV, actorId: ADA, expectedVersion: before.version });
    expect(res.status).toBe(200);
    const ok = await res.json();
    expect(ok).toMatchObject({ ok: true, row: { id: SLOT, person_id: DEV, person_status: 'Confirmed', version: before.version + 1 } });
    expect(await read()).toMatchObject({ person_id: DEV, person_status: 'Confirmed', updated_by: ADA });

    const stale = await post(claim, { slotId: SLOT, memberId: EVE, actorId: EVE, expectedVersion: before.version });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ ok: false, reason: 'conflict', holderName: 'Dev Drive', current: { person_id: DEV } });

    const u = await post(undo, { changeId: ok.changeId, actorId: ADA });
    expect(u.status).toBe(200);
    expect(await read()).toMatchObject({ person_id: null, person_status: 'Open' });

    const again = await read();
    await post(claim, { slotId: SLOT, memberId: EVE, actorId: EVE, expectedVersion: again.version });
    const filled = await read();
    const cleared = await post(claim, { slotId: SLOT, memberId: null, actorId: EVE, expectedVersion: filled.version });
    expect(cleared.status).toBe(200);
    expect(await read()).toMatchObject({ person_id: null, person_status: 'Open' });
  });

  it(`two people tap "Sign me up" at once: exactly one wins, ${ROUNDS} rounds`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await clear();
      const { version } = await read();
      const [a, b] = await Promise.all([
        post(claim, { slotId: SLOT, memberId: DEV, actorId: DEV, expectedVersion: version }),
        post(claim, { slotId: SLOT, memberId: EVE, actorId: EVE, expectedVersion: version }),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses, `round ${round}`).toEqual([200, 409]);
      const [ja, jb] = await Promise.all([a.json(), b.json()]);
      const winner = ja.ok ? DEV : EVE;
      const loser = ja.ok ? jb : ja;
      expect(loser).toMatchObject({ reason: 'conflict', holderName: winner === DEV ? 'Dev Drive' : 'Eve Feather' });
      expect(await read()).toMatchObject({ person_id: winner, version: version + 1 });
    }
  }, 60_000);
});
