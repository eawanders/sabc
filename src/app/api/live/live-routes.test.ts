import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, checkRateLimit } = vi.hoisted(() => ({ rpc: vi.fn(), checkRateLimit: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ rpc })) }));
vi.mock('@/server/live/flagStatus', () => ({ getFlagStatusText: vi.fn(async () => 'Light Blue') }));
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
import { POST as claimSeat } from './seat/claim/route';
import { POST as setSeatStatus } from './seat/status/route';
import { POST as swapSeats } from './seat/swap/route';
import { POST as claimTestSlot } from './test-slot/claim/route';
import { POST as setTestOutcome } from './test-slot/outcome/route';
import { POST as claimMarshalSlot } from './marshal-slot/claim/route';
import { POST as saveUnavailability } from './unavailability/route';
import { POST as saveOutingReport } from './outing-report/route';
import { POST as undo } from './undo/route';

const OUTING = '0123456789ABCDEF0123456789ABCDEF'; // unhyphenated, upper-case: canonicalised before the RPC
const OUTING_DB = '01234567-89ab-cdef-0123-456789abcdef';
const ADA = 'aaaaaaaa-0000-4000-8000-000000000001';
const BEN = 'aaaaaaaa-0000-4000-8000-000000000002';

function post(handler: (req: Request) => Promise<Response>, body: unknown, raw = false) {
  return handler(
    new Request('http://localhost/api/live/x', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.7' },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
  );
}

const seatRow = { outing_id: OUTING_DB, seat: 'Sub 1', member_id: ADA, status: 'Available', version: 3, updated_by: ADA };

describe('/api/live/* routes', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'http://127.0.0.1:1';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    rpc.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue(undefined);
    vi.mocked(logApiError).mockClear();
  });

  describe('validation (400, the RPC is never called)', () => {
    it.each([
      ['invalid JSON', claimSeat, '{not json', true],
      ['a non-object body', claimSeat, '[1,2]', true],
      ['a malformed outing id', claimSeat, { outingId: '../users/me', seat: 'Bow', memberId: null, actorId: ADA, expectedVersion: 0 }],
      ['an unknown seat', claimSeat, { outingId: OUTING, seat: '8 Seat', memberId: null, actorId: ADA, expectedVersion: 0 }],
      ['an unknown status', claimSeat, { outingId: OUTING, seat: 'Bow', memberId: ADA, status: 'Booked', actorId: ADA, expectedVersion: 0 }],
      ['a missing actor', claimSeat, { outingId: OUTING, seat: 'Bow', memberId: ADA, expectedVersion: 0 }],
      ['a negative version', claimSeat, { outingId: OUTING, seat: 'Bow', memberId: ADA, actorId: ADA, expectedVersion: -1 }],
      ['an extra key', claimSeat, { outingId: OUTING, seat: 'Bow', memberId: ADA, actorId: ADA, expectedVersion: 0, admin: true }],
      ['a status without expectedMemberId', setSeatStatus, { outingId: OUTING, seat: 'Bow', status: 'Available', actorId: ADA }],
      ['slot 7', claimTestSlot, { testId: OUTING, slot: 7, memberId: null, actorId: ADA, expectedVersion: 0 }],
      ['an unknown outcome', setTestOutcome, { testId: OUTING, slot: 1, outcome: 'Pass', actorId: ADA, expectedMemberId: ADA }],
      ['a non-id member', claimMarshalSlot, { slotId: OUTING, memberId: 'bob', actorId: ADA, expectedVersion: 0 }],
      ['overlapping ranges', saveUnavailability, {
        memberId: ADA, actorId: ADA, expectedVersion: 0,
        days: { monday: [{ start: '09:00', end: '12:00' }, { start: '11:00', end: '13:00' }], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] },
      }],
      ['a missing day', saveUnavailability, { memberId: ADA, actorId: ADA, expectedVersion: 0, days: { monday: [] } }],
      ['an unknown report field', saveOutingReport, { outingId: OUTING, fields: { notes: 'x' }, actorId: ADA, expectedVersion: 0 }],
      ['an over-long report field', saveOutingReport, { outingId: OUTING, fields: { boatFeel: 'x'.repeat(2001) }, actorId: ADA, expectedVersion: 0 }],
      ['a non-numeric change id', undo, { changeId: '12', actorId: ADA }],
    ])('rejects %s', async (_name, handler, body, raw = false) => {
      const res = await post(handler, body, raw as boolean);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, reason: 'invalid' });
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  it('maps drawer seat names and canonicalises ids before calling the RPC, with the flag status', async () => {
    rpc.mockResolvedValue({ data: { ok: true, change_id: 41, row: seatRow, outing_status: null }, error: null });
    const res = await post(claimSeat, {
      outingId: OUTING, seat: 'Sub1', memberId: ADA.toUpperCase(), status: 'Available', actorId: ADA, expectedVersion: 2,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, changeId: 41, row: seatRow, outingStatus: null });
    expect(rpc).toHaveBeenCalledWith('claim_seat', {
      p_outing_id: OUTING_DB,
      p_seat: 'Sub 1',
      p_member_id: ADA,
      p_status: 'Available',
      p_actor: ADA,
      p_expected_version: 2,
      p_flag_status: 'Light Blue',
    });
    expect(checkRateLimit).toHaveBeenCalledWith(`live:${ADA}:203.0.113.7`);
  });

  it('answers 409 with the current holder and who changed it', async () => {
    rpc.mockResolvedValue({
      data: { ok: false, reason: 'conflict', current: seatRow, holder_name: 'Ada', updated_by_name: 'Ben' },
      error: null,
    });
    const res = await post(claimSeat, { outingId: OUTING, seat: 'Bow', memberId: BEN, actorId: BEN, expectedVersion: 2 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false, reason: 'conflict', current: seatRow, holderName: 'Ada', updatedByName: 'Ben',
    });
  });

  it('says where a member already sits', async () => {
    rpc.mockResolvedValue({
      data: { ok: false, reason: 'conflict', current: seatRow, holder_name: 'Ada', updated_by_name: 'Ada', held_seat: 'Sub 1' },
      error: null,
    });
    const res = await post(claimSeat, { outingId: OUTING, seat: 'Bow', memberId: ADA, actorId: BEN, expectedVersion: 0 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ heldSeat: 'Sub 1', holderName: 'Ada' });
  });

  it('says which swim-test slot a member already holds', async () => {
    rpc.mockResolvedValue({
      data: { ok: false, reason: 'conflict', current: { slot: 2 }, holder_name: 'Ada', updated_by_name: 'Ada', held_slot: 2 },
      error: null,
    });
    const res = await post(claimTestSlot, { testId: OUTING, slot: 4, memberId: ADA, actorId: ADA, expectedVersion: 0 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ heldSlot: 2, holderName: 'Ada' });
  });

  it.each([
    [{ ok: false, reason: 'not_found' }, 404],
    [{ ok: false, reason: 'invalid', message: 'unknown actor' }, 400],
    [{ ok: false, reason: 'forbidden' }, 403],
  ])('maps %o to %i', async (data, status) => {
    rpc.mockResolvedValue({ data, error: null });
    const res = await post(undo, { changeId: 7, actorId: ADA });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(data);
  });

  it('passes the undo through with the flag status', async () => {
    rpc.mockResolvedValue({ data: { ok: true, change_id: 8, row: seatRow, outing_status: null }, error: null });
    await post(undo, { changeId: 7, actorId: ADA });
    expect(rpc).toHaveBeenCalledWith('undo_change', { p_change_id: 7, p_actor: ADA, p_flag_status: 'Light Blue' });
  });

  it('does not leak a Postgres error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'relation "public.secret_table" does not exist', code: '42P01' } });
    const res = await post(swapSeats, {
      outingId: OUTING, seatA: '7 Seat', seatB: 'Sub2', actorId: ADA, expectedVersionA: 1, expectedVersionB: 0,
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/secret_table|42P01|relation/);
    expect(JSON.parse(text)).toEqual({ ok: false, reason: 'error', message: 'Something went wrong. Please try again.' });
    expect(logApiError).toHaveBeenCalled();
  });

  it('does not leak a thrown client error', async () => {
    rpc.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const res = await post(claimMarshalSlot, { slotId: OUTING, memberId: null, actorId: ADA, expectedVersion: 1 });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
  });

  it('answers 500 without detail when the service role is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
    const { POST } = await import('./seat/status/route');
    const res = await post(POST, { outingId: OUTING, seat: 'Bow', status: 'Available', actorId: ADA, expectedMemberId: ADA });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toMatch(/SUPABASE/);
  });

  it('answers 429 when the actor is over the limit', async () => {
    checkRateLimit.mockRejectedValue(new RateLimitError('Rate limit exceeded', { limit: 30, reset: Date.now(), remaining: 0 }));
    const res = await post(claimTestSlot, { testId: OUTING, slot: 1, memberId: ADA, actorId: ADA, expectedVersion: 0 });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails open when the rate limiter is down', async () => {
    checkRateLimit.mockRejectedValue(new Error('database unreachable'));
    rpc.mockResolvedValue({ data: { ok: true, change_id: 1, row: {}, outing_status: null }, error: null });
    const res = await post(setTestOutcome, { testId: OUTING, slot: 1, outcome: 'Passed', actorId: ADA, expectedMemberId: ADA });
    expect(res.status).toBe(200);
  });

  it('sends only the report fields given, as database columns', async () => {
    rpc.mockResolvedValue({ data: { ok: true, change_id: 2, row: {}, outing_status: null }, error: null });
    await post(saveOutingReport, { outingId: OUTING, fields: { boatFeel: 'Set', nextFocus: null }, actorId: ADA, expectedVersion: 1 });
    expect(rpc).toHaveBeenCalledWith('save_outing_report', {
      p_outing_id: OUTING_DB, p_fields: { boat_feel: 'Set', next_focus: null }, p_actor: ADA, p_expected_version: 1,
    });
  });

  it('sends a swap with both seats mapped', async () => {
    rpc.mockResolvedValue({ data: { ok: true, change_id: 3, row: seatRow, rows: [seatRow, seatRow], outing_status: { from: 'Provisional', to: 'Confirmed' } }, error: null });
    const res = await post(swapSeats, {
      outingId: OUTING, seatA: '7 Seat', seatB: 'Sub2', actorId: ADA, expectedVersionA: 1, expectedVersionB: 0,
    });
    expect(await res.json()).toMatchObject({ ok: true, rows: [seatRow, seatRow], outingStatus: { to: 'Confirmed' } });
    expect(rpc).toHaveBeenCalledWith('swap_seats', expect.objectContaining({ p_seat_a: '7 Seat', p_seat_b: 'Sub 2' }));
  });
});
