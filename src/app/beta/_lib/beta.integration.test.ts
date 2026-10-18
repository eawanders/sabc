// Integration test against a LOCAL Supabase stack (never CI, never the live project).
// Reads the week as the beta page does (anon key), then claims a seat through the real
// /api/live/seat/claim route handler and checks the row and the change_log.
//
//   supabase start            # seed.sql provides the outing and members used here
//   BETA_IT_SUPABASE_URL=http://127.0.0.1:55321 \
//   BETA_IT_ANON_KEY=$(supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p') \
//   BETA_IT_SERVICE_ROLE_KEY=$(supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p') \
//   npx vitest run src/app/beta/_lib/beta.integration.test.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadWeek } from './week';
import { mondayOf } from './time';

vi.mock('@/server/live/flagStatus', () => ({ getFlagStatusText: vi.fn(async () => 'Green') }));
// These drive many writes as one actor; the limiter has its own tests (rate-limit.test.ts, 17_rate_limit)
vi.mock('@/app/api/_utils/rate-limit', async (orig) => ({ ...(await orig<object>()), checkRateLimit: vi.fn(async () => {}) }));

const url = process.env.BETA_IT_SUPABASE_URL;
const anonKey = process.env.BETA_IT_ANON_KEY;
const serviceKey = process.env.BETA_IT_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url ?? ''));

const OUTING = '00000000-0000-4000-8000-000000000101'; // seed.sql: 'M1 water session'
const ADA = '00000000-0000-4000-8000-000000000001';
const DEV = '00000000-0000-4000-8000-000000000004';
const SEAT = '5 Seat';

describe.skipIf(!enabled)('beta crew against local Supabase', () => {
  let anon: SupabaseClient;
  let service: SupabaseClient;
  let claim: (req: Request) => Promise<Response>;

  const post = (body: object) =>
    claim(
      new Request('http://localhost/api/live/seat/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify(body),
      }),
    );
  const seat = async () =>
    (await anon.from('outing_seats').select('*').eq('outing_id', OUTING).eq('seat', SEAT).single()).data as {
      member_id: string | null;
      status: string | null;
      version: number;
    };

  beforeAll(async () => {
    process.env.SUPABASE_URL = url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    service = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    ({ POST: claim } = await import('@/app/api/live/seat/claim/route'));
    // Start from an empty seat
    const s = await seat();
    if (s.member_id) await post({ outingId: OUTING, seat: SEAT, memberId: null, actorId: ADA, expectedVersion: s.version });
  });

  afterAll(async () => {
    const s = await seat();
    if (s?.member_id) await post({ outingId: OUTING, seat: SEAT, memberId: null, actorId: ADA, expectedVersion: s.version });
  });

  it('loads the week with the anon key, crew counted from the nine crew seats', async () => {
    const { data } = await anon.from('outings').select('start_at').eq('id', OUTING).single();
    const week = await loadWeek(anon, mondayOf(new Date(data!.start_at)));
    const outing = week.find((o) => o.id === OUTING);
    expect(outing).toMatchObject({ name: 'M1 water session', crewFilled: 5 }); // Cox, Stroke, 7, 6, Bow
    expect(week.every((o) => o.name !== 'Cancelled tank')).toBe(true); // unpublished: hidden from anon
  });

  it('claims a seat through the real route handler: row, change_log, then a stale claim conflicts', async () => {
    const before = await seat();
    const res = await post({
      outingId: OUTING,
      seat: SEAT,
      memberId: DEV,
      status: 'Awaiting Approval',
      actorId: ADA,
      expectedVersion: before.version,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, row: { seat: SEAT, member_id: DEV, version: before.version + 1 } });

    const after = await seat();
    expect(after).toMatchObject({ member_id: DEV, status: 'Awaiting Approval', version: before.version + 1 });

    const { data: log } = await service.from('change_log').select('*').eq('id', json.changeId).single();
    expect(log).toMatchObject({
      actor_member_id: ADA,
      entity: 'outing_seats',
      entity_key: { outing_id: OUTING, seat: SEAT },
    });
    expect(log.before.member_id).toBeNull();
    expect(log.after.member_id).toBe(DEV);

    const stale = await post({ outingId: OUTING, seat: SEAT, memberId: ADA, actorId: ADA, expectedVersion: before.version });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ ok: false, reason: 'conflict', holderName: 'Dev Drive', updatedByName: 'Ada Oarsworth' });
  });

  it('measures the handler round trip (claim + clear, 20 writes)', async () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const s = await seat();
      const t0 = performance.now();
      const res = await post({ outingId: OUTING, seat: SEAT, memberId: s.member_id ? null : DEV, actorId: ADA, expectedVersion: s.version });
      times.push(performance.now() - t0);
      expect(res.status).toBe(200);
    }
    times.sort((a, b) => a - b);
    console.info(`seat/claim handler round trip, local stack: median ${times[10].toFixed(1)} ms, p90 ${times[18].toFixed(1)} ms`);
  });
});
