// Integration test against a LOCAL Supabase stack (never CI, never production).
// Notion is faked; Postgres, PostgREST, triggers and RPCs are real.
//
//   supabase start && supabase db reset
//   SYNC_IT_SUPABASE_URL=http://127.0.0.1:55321 \
//   SYNC_IT_SERVICE_ROLE_KEY=$(supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p') \
//   npx vitest run src/server/sync/integration.test.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { backfillAppOwned } from './backfill';
import { createSupabaseSyncDb, type SyncDb } from './db';
import { syncSource } from './inbound';
import type { SyncNotion } from './notionApi';
import { runOutbox } from './outbox';
import { sourceByKey } from './sources';
import { page, relation, select, status, title } from './testing';

const url = process.env.SYNC_IT_SUPABASE_URL;
const key = process.env.SYNC_IT_SERVICE_ROLE_KEY;
const enabled = Boolean(url && key && /^http:\/\/(127\.0\.0\.1|localhost)/.test(url ?? ''));

const OUTING = 'dddddddd-0000-4000-8000-000000000001';
const SLOT = 'dddddddd-0000-4000-8000-000000000002';
const ADA = '00000000-0000-4000-8000-000000000001'; // seed.sql member
const BEN = '00000000-0000-4000-8000-000000000002'; // seed.sql member

describe.skipIf(!enabled)('sync against local Supabase', () => {
  // Built in beforeAll: a skipped describe body still runs at collection time.
  let client: SupabaseClient;
  let db: SyncDb;
  beforeAll(() => {
    client = createClient(url!, key!, { auth: { persistSession: false } });
    db = createSupabaseSyncDb(client);
  });

  const fakeNotion = (pages: Record<string, ReturnType<typeof page>[]>): SyncNotion => ({
    queryDataSource: vi.fn(async (id: string) => ({ results: pages[id] ?? [] })),
    retrievePage: vi.fn(),
    updatePage: vi.fn(async () => {}),
  });

  const outingPage = (name: string) =>
    page(OUTING, { Name: title(name), Status: status('Confirmed'), Cox: relation(ADA), 'Cox Status': status('Available') }, {
      last_edited_time: '2026-10-17T09:00:00.000Z',
    });

  const seats = async () =>
    (await client.from('outing_seats').select('seat, member_id, status, version').eq('outing_id', OUTING)).data ?? [];

  afterAll(async () => {
    await client.from('outings').delete().eq('id', OUTING);
    await client.from('marshal_slots').delete().eq('id', SLOT);
    await client.from('sync_state').delete().in('source', ['outings', 'marshal_slots']);
    await client.from('notion_outbox').delete().in('entity_key->>page_id', [OUTING, SLOT]);
    // Leave change_log as found: the pgTAP files count its rows.
    await client.from('change_log').delete().eq('entity_key->>outing_id', OUTING);
    await client.from('change_log').delete().eq('entity_key->>id', SLOT);
  });

  it('inbound upsert of a new outing creates its 14 seats; a re-run is idempotent', async () => {
    const outings = sourceByKey('outings');
    await syncSource(fakeNotion({ [outings.dataSourceId]: [outingPage('IT outing')] }), db, outings, { full: false });
    expect(await seats()).toHaveLength(14);

    // Notion's crew came in with the outing (reconcile of app-owned fields).
    expect((await seats()).find((s) => s.seat === 'Cox')).toMatchObject({ member_id: ADA, status: 'Available' });

    // The app claims a seat; its Notion patch is pending, so inbound sync must not touch it.
    const bow = (await seats()).find((s) => s.seat === 'Bow')!;
    const claim = await client.rpc('claim_seat', {
      p_outing_id: OUTING, p_seat: 'Bow', p_member_id: BEN, p_status: 'Reserved', p_actor: BEN, p_expected_version: bow.version,
    });
    expect(claim.data).toMatchObject({ ok: true });
    const before = await seats();

    await syncSource(fakeNotion({ [outings.dataSourceId]: [outingPage('IT outing, renamed')] }), db, outings);
    const after = await seats();
    expect(after).toHaveLength(14);
    expect(after).toEqual(expect.arrayContaining(before));
    expect(after.find((s) => s.seat === 'Bow')).toMatchObject({ member_id: BEN, status: 'Reserved' });
    const { data } = await client.from('outings').select('name').eq('id', OUTING).single();
    expect(data?.name).toBe('IT outing, renamed');
    expect((await db.getState('outings')).cursor).toBe('2026-10-17T09:00:00+00:00');
  });

  it('inbound upsert of a marshal slot keeps the app-owned sign-up', async () => {
    const marshals = sourceByKey('marshal_slots');
    const slot = () => page(SLOT, { Name: title('IT slot'), Person: relation(), 'Person Status': select('Open') });
    await syncSource(fakeNotion({ [marshals.dataSourceId]: [slot()] }), db, marshals);
    const claim = await client.rpc('claim_marshal_slot', { p_slot_id: SLOT, p_member_id: BEN, p_actor: BEN, p_expected_version: 0 });
    expect(claim.data).toMatchObject({ ok: true });

    await syncSource(fakeNotion({ [marshals.dataSourceId]: [slot()] }), db, marshals);
    const { data } = await client.from('marshal_slots').select('name, person_id, person_status, version').eq('id', SLOT).single();
    expect(data).toEqual({ name: 'IT slot', person_id: BEN, person_status: 'Confirmed', version: 1 });
  });

  it('backfill finds the reconciled seats already done and keeps the app claim', async () => {
    const notion = fakeNotion({ [sourceByKey('outings').dataSourceId]: [outingPage('IT outing, renamed')] });
    const first = await backfillAppOwned(notion, db);
    // Cox already came in through the inbound reconcile; Bow was claimed by the app.
    expect(first.seats).toMatchObject({ written: 0, keptAppChanges: 1 });
    expect((await seats()).find((s) => s.seat === 'Cox')).toMatchObject({ member_id: ADA, status: 'Available' });

    const second = await backfillAppOwned(notion, db);
    expect(second.seats.written).toBe(0);
  });

  it('outbox coalesces edits to one page and the worker completes it', async () => {
    // Settle the claims queued by the tests above.
    await client.from('notion_outbox').update({ done_at: new Date().toISOString() }).is('done_at', null)
      .in('entity_key->>page_id', [OUTING, SLOT]);
    const pageKey = { page_id: OUTING };
    await client.rpc('enqueue_notion_outbox', { p_entity: 'outing', p_entity_key: pageKey, p_payload: { 'Bow Status': { status: { name: 'Available' } } } });
    await client.rpc('enqueue_notion_outbox', { p_entity: 'outing', p_entity_key: pageKey, p_payload: { 'Cox Status': { status: { name: 'Reserved' } } } });
    const pending = (await client.from('notion_outbox').select('revision').is('done_at', null).eq('entity_key->>page_id', OUTING)).data;
    expect(pending).toEqual([{ revision: 2 }]);

    const notion = fakeNotion({});
    const result = await runOutbox(notion, db, { deadline: Date.now() + 10_000 });
    expect(result).toMatchObject({ sent: 1, stale: 0, failed: 0 });
    expect(notion.updatePage).toHaveBeenCalledWith(OUTING, {
      'Bow Status': { status: { name: 'Available' } },
      'Cox Status': { status: { name: 'Reserved' } },
    });
    const left = (await client.from('notion_outbox').select('id').is('done_at', null).eq('entity_key->>page_id', OUTING)).data;
    expect(left).toEqual([]);
  });
  it('outing status follows the ownership rule through the RPC', async () => {
    const outings = sourceByKey('outings');
    const withStatus = (name: string) =>
      page(OUTING, { Name: title('IT outing, renamed'), Status: status(name) }, { last_edited_time: '2026-10-17T09:10:00.000Z' });
    const dbStatus = async () => (await client.from('outings').select('status').eq('id', OUTING).single()).data?.status;
    const pendingRow = async () =>
      (await client.from('notion_outbox').select('payload, done_at').eq('entity_key->>page_id', OUTING).order('id', { ascending: false }).limit(1)).data?.[0];

    // The app auto-confirms and queues the Notion patch.
    await client.from('outings').update({ status: 'Confirmed' }).eq('id', OUTING);
    await client.rpc('enqueue_notion_outbox', { p_entity: 'outing', p_entity_key: { page_id: OUTING }, p_payload: { Status: { status: { name: 'Confirmed' } } } });

    await syncSource(fakeNotion({ [outings.dataSourceId]: [withStatus('Provisional')] }), db, outings);
    expect(await dbStatus()).toBe('Confirmed');

    await syncSource(fakeNotion({ [outings.dataSourceId]: [withStatus('Cancelled')] }), db, outings);
    expect(await dbStatus()).toBe('Cancelled');
    expect(await pendingRow()).toMatchObject({ payload: {} });
    expect((await pendingRow())?.done_at).not.toBeNull();
  });
  it('takes a current-app edit from Notion: logged as Notion, nothing echoed back', async () => {
    const outings = sourceByKey('outings');
    const edited = page(OUTING, { Name: title('IT outing, renamed'), Status: status('Cancelled'), Cox: relation(ADA),
      'Cox Status': status('Available'), Bow: relation(BEN), 'Bow Status': status('Reserved'),
      Stroke: relation(BEN.replace(/-/g, '')), 'Stroke Status': status('Available') },
      { last_edited_time: new Date(Date.now() + 60_000).toISOString() });
    const result = await syncSource(fakeNotion({ [outings.dataSourceId]: [edited] }), db, outings);

    // Ben in Bow and Stroke would seat him twice: Stroke is skipped and reported.
    expect(result.appOwned.skipped).toBe(1);
    expect((await seats()).find((s) => s.seat === 'Stroke')).toMatchObject({ member_id: null });

    // Ben moves Bow -> 7 Seat in Notion: both seats change together.
    const moved = page(OUTING, { ...edited.properties, Bow: relation(), Stroke: relation(), '7 Seat': relation(BEN),
      '7 Seat Status': status('Available') }, { last_edited_time: new Date(Date.now() + 120_000).toISOString() });
    const res = await syncSource(fakeNotion({ [outings.dataSourceId]: [moved] }), db, outings);
    expect(res.appOwned.skipped).toBe(0);
    const now = await seats();
    expect(now.find((s) => s.seat === 'Bow')).toMatchObject({ member_id: null });
    expect(now.find((s) => s.seat === '7 Seat')).toMatchObject({ member_id: BEN, status: 'Available' });

    const log = (await client.from('change_log').select('actor_member_id, source, entity_key')
      .eq('entity', 'outing_seats').eq('entity_key->>outing_id', OUTING).eq('entity_key->>seat', '7 Seat')).data;
    expect(log).toEqual([{ actor_member_id: null, source: 'notion', entity_key: { outing_id: OUTING, seat: '7 Seat' } }]);
    const pending = (await client.from('notion_outbox').select('id').is('done_at', null).eq('entity_key->>page_id', OUTING)).data;
    expect(pending).toEqual([]);
  });

  it('Realtime pushes a seat taken from Notion to subscribers', async () => {
    const outings = sourceByKey('outings');
    const received = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no Realtime event within 30 s')), 30_000);
      const channel = client
        .channel(`it-${Date.now()}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'outing_seats', filter: `outing_id=eq.${OUTING}` },
          (payload) => {
            if ((payload.new as { seat?: string }).seat !== 'Sub 1') return;
            clearTimeout(timer);
            void client.removeChannel(channel);
            resolve(payload.new as Record<string, unknown>);
          })
        // Write only once the server says the postgres_changes listener is live
        // (SUBSCRIBED alone can precede it on a freshly started stack).
        .on('system', {}, async (msg: { extension?: string; status?: string }) => {
          if (msg.extension !== 'postgres_changes' || msg.status !== 'ok') return;
          const page1 = page(OUTING, { Name: title('IT outing, renamed'), Status: status('Cancelled'), Cox: relation(ADA),
            'Cox Status': status('Available'), '7 Seat': relation(BEN), '7 Seat Status': status('Available'),
            'Sub 1': relation(ADA.replace(/-/g, '')) }, { last_edited_time: new Date(Date.now() + 180_000).toISOString() });
          // Cox is Ada too: Sub 1 would seat her twice, so move her out of Cox in the same edit.
          page1.properties!['Cox'] = relation();
          await syncSource(fakeNotion({ [outings.dataSourceId]: [page1] }), db, outings);
        })
        .subscribe();
    });
    const row = await received;
    expect(row).toMatchObject({ outing_id: OUTING, seat: 'Sub 1', member_id: ADA, updated_by: null });
  }, 35_000);
});
