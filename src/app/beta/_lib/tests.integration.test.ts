// Integration test against a LOCAL Supabase stack (never CI, never the live project).
// Reads tests as /beta/tests does (anon key), then books, sets outcomes, clears and undoes through
// the real /api/live/test-slot/* route handlers, and races two people for one slot.
//
//   supabase start            # seed.sql provides the swim test and members used here
//   BETA_IT_SUPABASE_URL=http://127.0.0.1:55321 \
//   BETA_IT_ANON_KEY=$(supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p') \
//   BETA_IT_SERVICE_ROLE_KEY=$(supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p') \
//   npx vitest run src/app/beta/_lib/tests.integration.test.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveResult, TestSlotRow } from '@/lib/live/types';
import { loadTest, loadTests } from './tests-data';
import { bookFirstFree } from './tests-state';

vi.mock('@/server/live/flagStatus', () => ({ getFlagStatusText: vi.fn(async () => 'Green') }));
// These drive many writes as one actor; the limiter has its own tests (rate-limit.test.ts, 17_rate_limit)
vi.mock('@/app/api/_utils/rate-limit', async (orig) => ({ ...(await orig<object>()), checkRateLimit: vi.fn(async () => {}) }));

const url = process.env.BETA_IT_SUPABASE_URL;
const anonKey = process.env.BETA_IT_ANON_KEY;
const serviceKey = process.env.BETA_IT_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url ?? ''));

const TEST = '00000000-0000-4000-8000-000000000301'; // seed.sql: 'Swim test (pool)', 6 slots, Eve in slot 1
const ADA = '00000000-0000-4000-8000-000000000001';
const BEN = '00000000-0000-4000-8000-000000000002';
const CORA = '00000000-0000-4000-8000-000000000003';
const EVE = '00000000-0000-4000-8000-000000000005';

type Handler = (req: Request) => Promise<Response>;

describe.skipIf(!enabled)('beta swim tests against local Supabase', () => {
  let anon: SupabaseClient;
  let service: SupabaseClient;
  let claim: Handler;
  let outcome: Handler;
  let undo: Handler;

  const post = (h: Handler, path: string, body: object, ip = '127.0.0.1') =>
    h(
      new Request(`http://localhost/api/live/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify(body),
      }),
    );
  const slot = async (n: number) =>
    (await anon.from('swim_test_slots').select('*').eq('test_id', TEST).eq('slot', n).single()).data as TestSlotRow;
  const book = (n: number, memberId: string | null, actorId: string, expectedVersion: number, ip?: string) =>
    post(claim, 'test-slot/claim', { testId: TEST, slot: n, memberId, actorId, expectedVersion }, ip);

  /** Empty slots 2..6 (slot 1 is Eve's, from the seed). */
  const reset = async () => {
    for (let n = 2; n <= 6; n++) {
      const s = await slot(n);
      if (s.member_id) expect((await book(n, null, ADA, s.version)).status).toBe(200);
    }
  };

  beforeAll(async () => {
    process.env.SUPABASE_URL = url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    service = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    ({ POST: claim } = await import('@/app/api/live/test-slot/claim/route'));
    ({ POST: outcome } = await import('@/app/api/live/test-slot/outcome/route'));
    ({ POST: undo } = await import('@/app/api/live/undo/route'));
  });
  beforeEach(reset);
  afterAll(reset);

  it('loads upcoming tests with their slots using the anon key', async () => {
    const { tests, slots } = await loadTests(anon, 'upcoming');
    expect(tests.find((t) => t.id === TEST)).toMatchObject({ title: 'Swim test (pool)', type: 'Swim Test', available_slots: 6 });
    expect(slots.filter((s) => s.test_id === TEST)).toHaveLength(6);
    expect(slots.find((s) => s.test_id === TEST && s.slot === 1)).toMatchObject({ member_id: EVE, outcome: 'Test Booked' });
    const past = await loadTests(anon, 'past');
    expect(past.tests.some((t) => t.id === TEST)).toBe(false);
    expect((await loadTest(anon, TEST))?.slots).toHaveLength(6);
  });

  it('books, sets the outcome, clears, and undoes through the real routes', async () => {
    const before = await slot(2);
    const res = await book(2, ADA, ADA, before.version);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, row: { slot: 2, member_id: ADA, outcome: 'Test Booked' } });

    const passed = await post(outcome, 'test-slot/outcome', { testId: TEST, slot: 2, outcome: 'Passed', actorId: BEN, expectedMemberId: ADA });
    expect(passed.status).toBe(200);
    const passedJson = await passed.json();
    expect(passedJson).toMatchObject({ ok: true, row: { member_id: ADA, outcome: 'Passed' } });
    const { data: log } = await service.from('change_log').select('*').eq('id', passedJson.changeId).single();
    expect(log).toMatchObject({ actor_member_id: BEN, entity: 'swim_test_slots', entity_key: { test_id: TEST, slot: 2 } });

    // An outcome for someone who is no longer in the slot is refused, naming who is
    const stale = await post(outcome, 'test-slot/outcome', { testId: TEST, slot: 2, outcome: 'Failed', actorId: BEN, expectedMemberId: CORA });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ ok: false, reason: 'conflict', holderName: 'Ada Oarsworth' });

    // Undo the outcome: back to Test Booked
    const undone = await post(undo, 'undo', { changeId: passedJson.changeId, actorId: BEN });
    expect(undone.status).toBe(200);
    expect(await slot(2)).toMatchObject({ member_id: ADA, outcome: 'Test Booked' });

    // Clearing sets No Show, as the current app does
    const cleared = await book(2, null, ADA, (await slot(2)).version);
    expect(cleared.status).toBe(200);
    expect(await slot(2)).toMatchObject({ member_id: null, outcome: 'No Show' });
  });

  it('two people racing for one slot: exactly one wins, the other is told who has it', async () => {
    const { version } = await slot(3);
    const [a, b] = await Promise.all([book(3, ADA, ADA, version, '10.0.0.1'), book(3, BEN, BEN, version, '10.0.0.2')]);
    const results = [await a.json(), await b.json()] as LiveResult<TestSlotRow>[];
    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const winner = (winners[0] as { row: TestSlotRow }).row.member_id;
    expect((await slot(3)).member_id).toBe(winner);
    expect(losers[0]).toMatchObject({
      reason: 'conflict',
      holderName: winner === ADA ? 'Ada Oarsworth' : 'Ben Blade',
      current: { member_id: winner },
    });
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it('two people pressing Book me at once both get a slot, never the same one', async () => {
    // Both see the same screen: slots 2..6 empty
    const screen = new Map<number, TestSlotRow>();
    for (let n = 1; n <= 6; n++) screen.set(n, await slot(n));
    const bookMe = (me: string, ip: string) =>
      bookFirstFree({
        available: 6,
        me,
        row: (n) => screen.get(n),
        busy: () => false,
        claim: async (n, v) => (await book(n, me, me, v, ip)).json(),
      });
    const [ada, ben] = await Promise.all([bookMe(ADA, '10.0.1.1'), bookMe(BEN, '10.0.1.2')]);
    expect(ada.kind).toBe('booked');
    expect(ben.kind).toBe('booked');
    const slots = [ada, ben].map((o) => (o.kind === 'booked' ? o.slot : 0)).sort();
    expect(slots).toEqual([2, 3]);
    const loser = [ada, ben].find((o) => o.kind === 'booked' && o.slot === 3);
    expect(loser && loser.kind === 'booked' && loser.lost).toEqual([{ slot: 2, holderName: expect.any(String) }]);
    expect((await slot(2)).member_id).not.toBe((await slot(3)).member_id);
  });
});
