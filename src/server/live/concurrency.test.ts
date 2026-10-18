// Concurrency check against a real local Supabase stack (PER-276). Not run in CI: it needs
//   LIVE_DB_TEST_URL=http://127.0.0.1:55321  LIVE_DB_TEST_SERVICE_KEY=<local secret key from `supabase status`>
// and the seed data (`supabase db reset`). Two separate clients fire the same write in parallel;
// PostgREST serves them on separate database connections, so they really race.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { addGuest } from './guestMember';

const url = process.env.LIVE_DB_TEST_URL;
const key = process.env.LIVE_DB_TEST_SERVICE_KEY;
const ROUNDS = 50;

// From supabase/seed.sql: the W1 erg (no seats filled) and four members not in it
const OUTING = '00000000-0000-4000-8000-000000000102';
const [DEV, EVE, FINN, GUS] = ['04', '05', '06', '07'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);

function client(): SupabaseClient {
  return createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function seatVersion(db: SupabaseClient, seat: string): Promise<number> {
  const { data, error } = await db.from('outing_seats').select('version').eq('outing_id', OUTING).eq('seat', seat).single();
  if (error) throw error;
  return data.version as number;
}

async function claim(db: SupabaseClient, seat: string, member: string | null, actor: string, version: number) {
  const { data, error } = await db.rpc('claim_seat', {
    p_outing_id: OUTING, p_seat: seat, p_member_id: member, p_status: null, p_actor: actor, p_expected_version: version,
  });
  if (error) throw error;
  return data as { ok: boolean; reason?: string; holder_name?: string; held_seat?: string };
}

// From supabase/seed.sql: 'Swim test (pool)', Eve in slot 1, slots 2..6 free
const SWIM_TEST = '00000000-0000-4000-8000-000000000301';

async function slotVersion(db: SupabaseClient, slot: number): Promise<number> {
  const { data, error } = await db.from('swim_test_slots').select('version').eq('test_id', SWIM_TEST).eq('slot', slot).single();
  if (error) throw error;
  return data.version as number;
}

async function claimSlot(db: SupabaseClient, slot: number, member: string | null, actor: string, version: number) {
  const { data, error } = await db.rpc('claim_test_slot', {
    p_test_id: SWIM_TEST, p_slot: slot, p_member_id: member, p_actor: actor, p_expected_version: version,
  });
  if (error) throw error;
  return data as { ok: boolean; reason?: string; held_slot?: number };
}

describe.skipIf(!url || !key)('claims under real concurrency (local stack)', () => {
  it(`two parallel claims of one seat at the same version: exactly one winner, ${ROUNDS} rounds`, async () => {
    const [a, b] = [client(), client()];
    for (let round = 0; round < ROUNDS; round++) {
      const version = await seatVersion(a, '5 Seat');
      const [ra, rb] = await Promise.all([
        claim(a, '5 Seat', DEV, DEV, version),
        claim(b, '5 Seat', EVE, EVE, version),
      ]);
      const winners = [ra, rb].filter((r) => r.ok);
      expect(winners, `round ${round}`).toHaveLength(1);
      const loser = ra.ok ? rb : ra;
      expect(loser.reason).toBe('conflict');
      expect(loser.holder_name).toBe(ra.ok ? 'Dev Drive' : 'Eve Feather');
    }
  }, 60_000);

  it(`one member claimed into two seats in parallel: exactly one lands, ${ROUNDS} rounds`, async () => {
    const [a, b] = [client(), client()];
    for (let round = 0; round < ROUNDS; round++) {
      // Empty both seats first (sequentially)
      for (const seat of ['3 Seat', '4 Seat']) {
        const r = await claim(a, seat, null, GUS, await seatVersion(a, seat));
        expect(r.ok).toBe(true);
      }
      const [v3, v4] = [await seatVersion(a, '3 Seat'), await seatVersion(a, '4 Seat')];
      const [ra, rb] = await Promise.all([claim(a, '3 Seat', FINN, FINN, v3), claim(b, '4 Seat', FINN, FINN, v4)]);
      expect([ra, rb].filter((r) => r.ok), `round ${round}`).toHaveLength(1);
      const loser = ra.ok ? rb : ra;
      expect(loser).toMatchObject({ reason: 'conflict', held_seat: ra.ok ? '3 Seat' : '4 Seat' });
    }
  }, 60_000);

  it(`one member booked into two slots of one swim test in parallel: exactly one lands, ${ROUNDS} rounds`, async () => {
    const [a, b] = [client(), client()];
    for (let round = 0; round < ROUNDS; round++) {
      for (const slot of [3, 4]) {
        const r = await claimSlot(a, slot, null, GUS, await slotVersion(a, slot));
        expect(r.ok).toBe(true);
      }
      const [v3, v4] = [await slotVersion(a, 3), await slotVersion(a, 4)];
      const [ra, rb] = await Promise.all([claimSlot(a, 3, DEV, DEV, v3), claimSlot(b, 4, DEV, DEV, v4)]);
      expect([ra, rb].filter((r) => r.ok), `round ${round}`).toHaveLength(1);
      const loser = ra.ok ? rb : ra;
      expect(loser).toMatchObject({ reason: 'conflict', held_slot: ra.ok ? 3 : 4 });
    }
  }, 60_000);

  it('two simultaneous guest adds of one new name create one page (Notion faked), 10 rounds', async () => {
    const [a, b] = [client(), client()];
    for (let round = 0; round < 10; round++) {
      const name = `Race Guest ${randomUUID().slice(0, 8)}`;
      let pages = 0;
      const createPage = async () => {
        pages++;
        await new Promise((r) => setTimeout(r, 150)); // a Notion round trip
        return randomUUID();
      };
      const [ra, rb] = await Promise.all([
        addGuest(name, { db: a, createPage }),
        addGuest(`  ${name.toUpperCase()} `, { db: b, createPage }),
      ]);
      expect(pages, `round ${round}`).toBe(1);
      expect(ra.member.id).toBe(rb.member.id);
      expect([ra.created, rb.created].sort()).toEqual([false, true]);
    }
  }, 60_000);
});
