// Integration test against a LOCAL Supabase stack (never CI, never the live project).
// Home's server read and My week's read with the anon key, then a reply through the real
// /api/live/seat/status handler (expectedMemberId), a stale reply that conflicts, and undo.
//
//   supabase start            # seed.sql provides the outings, members and tests used here
//   BETA_IT_SUPABASE_URL=http://127.0.0.1:55321 \
//   BETA_IT_ANON_KEY=$(supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p') \
//   BETA_IT_SERVICE_ROLE_KEY=$(supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p') \
//   npx vitest run src/app/beta/_lib/home-week.integration.test.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadHome } from './home-data';
import { loadMine } from './myweek-load';
import { emptyMine, mineReducer, myRows } from './myweek-state';

vi.mock('@/server/live/flagStatus', () => ({ getFlagStatusText: vi.fn(async () => 'Green') }));

const url = process.env.BETA_IT_SUPABASE_URL;
const anonKey = process.env.BETA_IT_ANON_KEY;
const serviceKey = process.env.BETA_IT_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url ?? ''));

const OUTING = '00000000-0000-4000-8000-000000000101'; // seed.sql: 'M1 water session'
const ADA = '00000000-0000-4000-8000-000000000001'; // Stroke, Available
const BEN = '00000000-0000-4000-8000-000000000002';
const SEAT = 'Stroke';

describe.skipIf(!enabled)('home and my week against local Supabase', () => {
  let anon: SupabaseClient;
  let status: (req: Request) => Promise<Response>;
  let undo: (req: Request) => Promise<Response>;

  const post = (handler: (req: Request) => Promise<Response>, path: string, body: object) =>
    handler(
      new Request(`http://localhost/api/live/${path}`, {
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
    ({ POST: status } = await import('@/app/api/live/seat/status/route'));
    ({ POST: undo } = await import('@/app/api/live/undo/route'));
    const s = await seat();
    if (s.status !== 'Available') {
      await post(status, 'seat/status', { outingId: OUTING, seat: SEAT, status: 'Available', actorId: ADA, expectedMemberId: ADA });
    }
  });

  afterAll(async () => {
    const s = await seat();
    if (s?.status !== 'Available') {
      await post(status, 'seat/status', { outingId: OUTING, seat: SEAT, status: 'Available', actorId: ADA, expectedMemberId: ADA });
    }
  });

  it('reads every Home section with the anon key', async () => {
    const home = await loadHome(anon);
    expect(home.sessions.error).toBeNull();
    const sessions = home.sessions.data ?? [];
    expect(sessions.find((o) => o.name === 'M1 water session')).toMatchObject({ crewFilled: 5 });
    expect(sessions.some((o) => o.name === 'Cancelled tank')).toBe(false); // unpublished
    expect(home.coxes.data?.map((c) => c.name)).toEqual(['Ivo Rudder']);
    expect(home.tests.data?.[0]).toMatchObject({ title: 'Swim test (pool)', booked: 1, slots: 6, full: false });
    expect(home.nextEvent.data).toMatchObject({ title: 'Club dinner', hasForm: false });
    expect(home.recent).toEqual({ data: [], error: null });
  });

  it("loads Ada's week: her seat, with the outing's crew", async () => {
    const from = new Date(Date.now() - 864e5).toISOString();
    const to = new Date(Date.now() + 8 * 864e5).toISOString();
    const loaded = await loadMine(anon, ADA, from, to);
    expect(loaded.outings.map((o) => o.id)).toEqual([OUTING]);
    const rows = myRows(mineReducer(emptyMine, { type: 'load', ...loaded }), ADA);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ seat: SEAT, crewFilled: 5, row: { status: 'Available' } });
    expect((await loadMine(anon, ADA, to, new Date(Date.now() + 30 * 864e5).toISOString())).outings).toEqual([]);
  });

  it('saves a reply, rejects a stale one, and undoes', async () => {
    const before = await seat();
    const res = await post(status, 'seat/status', { outingId: OUTING, seat: SEAT, status: 'Maybe Available', actorId: ADA, expectedMemberId: ADA });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, row: { seat: SEAT, member_id: ADA, status: 'Maybe Available', version: before.version + 1 } });

    // The screen still showed Ben in the seat: nothing is written
    const stale = await post(status, 'seat/status', { outingId: OUTING, seat: SEAT, status: 'Not Available', actorId: BEN, expectedMemberId: BEN });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ ok: false, reason: 'conflict', current: { member_id: ADA, status: 'Maybe Available' } });

    const undone = await post(undo, 'undo', { changeId: json.changeId, actorId: ADA });
    expect(undone.status).toBe(200);
    expect(await seat()).toMatchObject({ member_id: ADA, status: 'Available' });
  });
});
