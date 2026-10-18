// Integration tests against a LOCAL Supabase stack (never CI, never the live project). Each write
// path the schedule uses goes through its real route handler; Notion is mocked (guest creation).
//
//   supabase db reset          # in a scratch copy of supabase/ (seed.sql provides the data)
//   BETA_IT_SUPABASE_URL=http://127.0.0.1:<port> BETA_IT_ANON_KEY=... BETA_IT_SERVICE_ROLE_KEY=... \
//   npx vitest run src/app/beta/schedule/_lib/schedule.integration.test.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { mondayOf, weekRange } from '../../_lib/time';
import { monthGrid, monthOf } from './calendar';
import { loadSchedule } from './load';
import { subSwaps } from './rules';

vi.mock('@/server/live/flagStatus', () => ({ getFlagStatusText: vi.fn(async () => 'Green') }));
// These drive many writes as one actor; the limiter has its own tests (rate-limit.test.ts, 17_rate_limit)
vi.mock('@/app/api/_utils/rate-limit', async (orig) => ({ ...(await orig<object>()), checkRateLimit: vi.fn(async () => {}), checkLiveWriteRateLimit: vi.fn(async () => {}) }));
const { notionRequest } = vi.hoisted(() => ({ notionRequest: vi.fn() }));
vi.mock('@/server/notion/client', () => ({ getNotionClient: () => ({ request: notionRequest }) }));

const url = process.env.BETA_IT_SUPABASE_URL;
const anonKey = process.env.BETA_IT_ANON_KEY;
const serviceKey = process.env.BETA_IT_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url ?? ''));

const WATER = '00000000-0000-4000-8000-000000000101'; // 'M1 water session'
const ERG = '00000000-0000-4000-8000-000000000102'; // 'W1 erg', no seats filled
const ADA = '00000000-0000-4000-8000-000000000001';
const [DEV, EVE, FINN, GUS] = ['04', '05', '06', '07'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);

type Handler = (req: Request) => Promise<Response>;

describe.skipIf(!enabled)('beta schedule against local Supabase', () => {
  let anon: SupabaseClient;
  let service: SupabaseClient;
  let routes: Record<'claim' | 'swap' | 'report' | 'undo' | 'guest', Handler>;

  const post = async (h: Handler, body: object) => {
    const res = await h(
      new Request('http://localhost/api/live/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify(body),
      }),
    );
    return { status: res.status, json: await res.json() };
  };
  const seat = async (outing: string, name: string) =>
    (await anon.from('outing_seats').select('*').eq('outing_id', outing).eq('seat', name).single()).data as {
      seat: string;
      member_id: string | null;
      status: string | null;
      version: number;
    };
  const claim = async (outing: string, name: string, memberId: string | null, status: string | null) => {
    const s = await seat(outing, name);
    const r = await post(routes.claim, { outingId: outing, seat: name, memberId, status, actorId: ADA, expectedVersion: s.version });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    return r.json;
  };

  beforeAll(async () => {
    process.env.SUPABASE_URL = url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    service = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    routes = {
      claim: (await import('@/app/api/live/seat/claim/route')).POST,
      swap: (await import('@/app/api/live/seat/swap/route')).POST,
      report: (await import('@/app/api/live/outing-report/route')).POST,
      undo: (await import('@/app/api/live/undo/route')).POST,
      guest: (await import('@/app/api/live/member/add/route')).POST,
    };
  });

  it('loads a week and a month with every filled seat, published outings only', async () => {
    const { data } = await anon.from('outings').select('start_at').eq('id', WATER).single();
    const start = new Date(data!.start_at);
    const week = weekRange(mondayOf(start));
    const outings = await loadSchedule(anon, week.start, week.end);
    const water = outings.find((o) => o.id === WATER)!;
    expect(water.seats.map((s) => s.seat).sort()).toEqual(['6 Seat', '7 Seat', 'Bow', 'Coach/Bank Rider', 'Cox', 'Stroke']);
    expect(water.crewFilled).toBe(5);
    expect(outings.some((o) => o.name === 'Cancelled tank')).toBe(false);

    const grid = monthGrid(monthOf(start));
    const month = await loadSchedule(anon, grid.start, grid.end);
    expect(month.map((o) => o.id)).toContain(WATER);
  });

  it('marks a seat Reserved with no one in it, then clears it', async () => {
    const r = await claim(ERG, '3 Seat', null, 'Reserved');
    expect(r.row).toMatchObject({ member_id: null, status: 'Reserved' });
    const c = await claim(ERG, '3 Seat', null, 'Awaiting Approval');
    expect(c.row).toMatchObject({ member_id: null, status: 'Awaiting Approval' });
  });

  it('swaps in subs: each pair is one swap call, member and status, one undo reverses both seats', async () => {
    await claim(ERG, '5 Seat', DEV, 'Not Available');
    await claim(ERG, '2 Seat', EVE, 'Not Available');
    await claim(ERG, 'Sub 1', FINN, 'Available');
    await claim(ERG, 'Sub 3', GUS, 'Available');

    const seats: Record<string, { member_id: string | null; status: string | null; version: number }> = {};
    for (const s of ['Cox', 'Stroke', '7 Seat', '6 Seat', '5 Seat', '4 Seat', '3 Seat', '2 Seat', 'Bow', 'Sub 1', 'Sub 2', 'Sub 3', 'Sub 4']) {
      seats[s] = await seat(ERG, s);
    }
    const pairs = subSwaps((s) => seats[s]);
    expect(pairs).toEqual([
      { crew: '5 Seat', sub: 'Sub 1' },
      { crew: '2 Seat', sub: 'Sub 3' },
    ]);

    const changeIds: number[] = [];
    for (const p of pairs) {
      const r = await post(routes.swap, {
        outingId: ERG, seatA: p.crew, seatB: p.sub, actorId: ADA,
        expectedVersionA: seats[p.crew].version, expectedVersionB: seats[p.sub].version,
      });
      expect(r.status, JSON.stringify(r.json)).toBe(200);
      changeIds.push(r.json.changeId);
    }
    expect(await seat(ERG, '5 Seat')).toMatchObject({ member_id: FINN, status: 'Available' });
    expect(await seat(ERG, 'Sub 1')).toMatchObject({ member_id: DEV, status: 'Not Available' });
    expect(await seat(ERG, '2 Seat')).toMatchObject({ member_id: GUS, status: 'Available' });
    expect(await seat(ERG, 'Sub 3')).toMatchObject({ member_id: EVE, status: 'Not Available' });

    // A stale second click conflicts instead of swapping back
    const stale = await post(routes.swap, {
      outingId: ERG, seatA: '5 Seat', seatB: 'Sub 1', actorId: ADA,
      expectedVersionA: seats['5 Seat'].version, expectedVersionB: seats['Sub 1'].version,
    });
    expect(stale.status).toBe(409);

    const undo = await post(routes.undo, { changeId: changeIds[1], actorId: ADA });
    expect(undo.status, JSON.stringify(undo.json)).toBe(200);
    expect(await seat(ERG, '2 Seat')).toMatchObject({ member_id: EVE, status: 'Not Available' });
    expect(await seat(ERG, 'Sub 3')).toMatchObject({ member_id: GUS, status: 'Available' });
  });

  it('saves the outing report with the version seen, conflicts on a stale one, and undoes', async () => {
    const before = (await anon.from('outing_reports').select('*').eq('outing_id', WATER).single()).data!;
    const ok = await post(routes.report, {
      outingId: WATER, fields: { boatFeel: 'Light and quick', coachFeedback: 'Good' }, actorId: ADA, expectedVersion: before.version,
    });
    expect(ok.status, JSON.stringify(ok.json)).toBe(200);
    expect(ok.json.row).toMatchObject({
      outing_summary: before.outing_summary, // untouched fields stay
      boat_feel: 'Light and quick',
      coach_feedback: 'Good',
      version: before.version + 1,
    });

    const stale = await post(routes.report, { outingId: WATER, fields: { boatFeel: 'Heavy' }, actorId: ADA, expectedVersion: before.version });
    expect(stale.status).toBe(409);
    expect(stale.json).toMatchObject({ reason: 'conflict', current: { boat_feel: 'Light and quick' }, updatedByName: 'Ada Oarsworth' });

    // A first report on an outing with none yet saves at version 0
    const first = await post(routes.report, { outingId: ERG, fields: { outingSummary: '3 x 2k done' }, actorId: ADA, expectedVersion: 0 });
    expect(first.status, JSON.stringify(first.json)).toBe(200);

    const undo = await post(routes.undo, { changeId: ok.json.changeId, actorId: ADA });
    expect(undo.status).toBe(200);
    const after = (await anon.from('outing_reports').select('*').eq('outing_id', WATER).single()).data!;
    expect(after).toMatchObject({ boat_feel: before.boat_feel, coach_feedback: before.coach_feedback });
  });

  it('adds a guest to members (Notion mocked) who can be seated at once, and dedupes by name', async () => {
    const pageId = `0000000000004000800000${String(Date.now()).slice(-10)}`;
    notionRequest.mockResolvedValueOnce({ id: pageId });
    const added = await post(routes.guest, { name: '  Grace   Hopper ', actor: ADA });
    expect(added.status, JSON.stringify(added.json)).toBe(200);
    const id = added.json.member.id as string;
    expect(added.json.member.name).toBe('Grace Hopper');

    const { data: row } = await service.from('members').select('name, member_type').eq('id', id).single();
    expect(row).toEqual({ name: 'Grace Hopper', member_type: ['Non-Member'] });

    const seated = await claim(ERG, '7 Seat', id, 'Awaiting Approval');
    expect(seated.row.member_id).toBe(id);

    notionRequest.mockClear();
    const again = await post(routes.guest, { name: 'grace hopper', actor: null });
    expect(again.json).toEqual({ ok: true, member: { id, name: 'Grace Hopper' } });
    const existing = await post(routes.guest, { name: 'ADA OARSWORTH', actor: null });
    expect(existing.json.member.id).toBe(ADA);
    expect(notionRequest).not.toHaveBeenCalled();
  });
});
