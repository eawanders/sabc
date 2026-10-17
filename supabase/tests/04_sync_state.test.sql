-- PER-275: sync bookkeeping is server-only, and an inbound upsert of an outing
-- (insert, then the same row again) leaves exactly 14 seats.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select has_table('public', 'sync_state', 'sync_state exists');
select has_table('public', 'notion_webhook_handshake', 'notion_webhook_handshake exists');

select ok(not has_table_privilege('anon', 'public.sync_state', 'select'), 'anon cannot read sync_state');
select ok(not has_table_privilege('authenticated', 'public.notion_webhook_handshake', 'select'),
  'authenticated cannot read the webhook handshake token');

select throws_ok(
  $$insert into public.sync_state (source) values ('not_a_source')$$,
  '23514', null, 'only known data sources have a cursor');

-- The sync upserts outing details on id; the second pass is an UPDATE, so no extra seats.
insert into public.outings (id, name) values ('cccccccc-0000-4000-8000-000000000001', 'Synced outing')
  on conflict (id) do update set name = excluded.name;
insert into public.outings (id, name) values ('cccccccc-0000-4000-8000-000000000001', 'Synced outing, renamed')
  on conflict (id) do update set name = excluded.name;

select is((select count(*)::int from public.outing_seats where outing_id = 'cccccccc-0000-4000-8000-000000000001'), 14,
  'an upserted outing has its 14 seats exactly once');
select is((select name from public.outings where id = 'cccccccc-0000-4000-8000-000000000001'), 'Synced outing, renamed',
  'the second upsert updates the details');

select * from finish();
rollback;
