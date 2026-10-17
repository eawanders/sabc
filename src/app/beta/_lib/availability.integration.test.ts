// Integration test for /beta/availability against a LOCAL Supabase stack (never CI, never the live
// project): saves through the real /api/live/unavailability handler, checks a stale save is refused,
// that Realtime delivers the row to an anon subscriber (what the crew drawer listens to), and undo.
//
//   supabase start            # seed.sql provides the members used here
//   AVAIL_IT_SUPABASE_URL=http://127.0.0.1:55321 \
//   AVAIL_IT_ANON_KEY=$(supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p') \
//   AVAIL_IT_SERVICE_ROLE_KEY=$(supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p') \
//   npx vitest run src/app/beta/_lib/availability.integration.test.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { UnavailabilityRow } from '@/lib/live/types';
import { subscribeToTable } from '@/lib/live/realtime';
import { daysFromRow, emptyWeek } from './availability-edit';
import { fitFor } from './availability';

const url = process.env.AVAIL_IT_SUPABASE_URL;
const anonKey = process.env.AVAIL_IT_ANON_KEY;
const serviceKey = process.env.AVAIL_IT_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url ?? ''));

const ADA = '00000000-0000-4000-8000-000000000001';
const BEN = '00000000-0000-4000-8000-000000000002';
const CORA = '00000000-0000-4000-8000-000000000003'; // no member_unavailability row in seed.sql

type Handler = (req: Request) => Promise<Response>;

describe.skipIf(!enabled)('beta availability against local Supabase', () => {
  let anon: SupabaseClient;
  let service: SupabaseClient;
  let save: Handler;
  let undo: Handler;
  let original: UnavailabilityRow;

  const post = (h: Handler, path: string, body: object) =>
    h(
      new Request(`http://localhost/api/live/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify(body),
      }),
    );
  const read = async (id: string) =>
    (await anon.from('member_unavailability').select('*').eq('member_id', id).maybeSingle()).data as UnavailabilityRow | null;

  beforeAll(async () => {
    process.env.SUPABASE_URL = url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    service = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    ({ POST: save } = await import('@/app/api/live/unavailability/route'));
    ({ POST: undo } = await import('@/app/api/live/undo/route'));
    original = (await read(BEN))!;
  });

  afterAll(async () => {
    // Put Ben back as seeded; remove Cora's row so the test can run again
    const now = await read(BEN);
    if (now) {
      await post(save, 'unavailability', {
        memberId: BEN,
        days: daysFromRow(original),
        actorId: ADA,
        expectedVersion: now.version,
      });
    }
    await service.from('member_unavailability').delete().eq('member_id', CORA);
  });

  it("saves someone else's week, refuses a stale save, and Realtime carries the row", async () => {
    const before = (await read(BEN))!;
    const days = { ...daysFromRow(before), friday: [{ start: '06:00', end: '09:00' }] };

    const seen: UnavailabilityRow[] = [];
    const off = subscribeToTable<UnavailabilityRow>('member_unavailability', (c) => c.new && seen.push(c.new), {
      filter: `member_id=eq.${BEN}`,
      client: anon,
    });
    await new Promise((r) => setTimeout(r, 1500)); // let the channel join

    const res = await post(save, 'unavailability', { memberId: BEN, days, actorId: ADA, expectedVersion: before.version });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, row: { member_id: BEN, version: before.version + 1, updated_by: ADA } });
    expect((await read(BEN))!.friday).toEqual([{ start: '06:00', end: '09:00' }]);

    // The crew picker's grouping now sees Ben as unavailable for a Friday 07:00 outing
    const friday = new Date('2026-10-23T06:00:00Z'); // Fri 07:00 BST
    expect(fitFor(daysFromRow((await read(BEN))!), friday, new Date('2026-10-23T07:00:00Z'))).toBe('unavailable');

    for (let i = 0; i < 30 && !seen.some((r) => r.version === before.version + 1); i++) await new Promise((r) => setTimeout(r, 200));
    off();
    expect(seen.find((r) => r.version === before.version + 1)?.friday).toEqual([{ start: '06:00', end: '09:00' }]);

    // A save from a screen that still shows the old version is refused, naming who saved
    const stale = await post(save, 'unavailability', {
      memberId: BEN,
      days: emptyWeek(),
      actorId: BEN,
      expectedVersion: before.version,
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      ok: false,
      reason: 'conflict',
      updatedByName: 'Ada Oarsworth',
      current: { member_id: BEN, version: before.version + 1 },
    });

    // Undo puts the old ranges back
    const u = await post(undo, 'undo', { changeId: json.changeId, actorId: ADA });
    expect(u.status).toBe(200);
    expect((await u.json()).row).toMatchObject({ member_id: BEN, friday: before.friday });
    expect((await read(BEN))!.friday).toEqual(before.friday);
  }, 20_000);

  it('creates the row for a member who has none, at version 0', async () => {
    expect(await read(CORA)).toBeNull();
    const days = { ...emptyWeek(), sunday: [{ start: '00:00', end: '23:59' }] };
    const res = await post(save, 'unavailability', { memberId: CORA, days, actorId: CORA, expectedVersion: 0 });
    expect(res.status).toBe(200);
    expect((await read(CORA))!.sunday).toEqual([{ start: '00:00', end: '23:59' }]);
  });

  it('rejects overlapping ranges before they reach the database', async () => {
    const before = (await read(BEN))!;
    const days = { ...emptyWeek(), monday: [{ start: '07:00', end: '09:00' }, { start: '08:00', end: '10:00' }] };
    const res = await post(save, 'unavailability', { memberId: BEN, days, actorId: ADA, expectedVersion: before.version });
    expect(res.status).toBe(400);
    expect((await read(BEN))!.version).toBe(before.version);
  });
});
