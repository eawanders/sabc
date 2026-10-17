-- RLS and grants: the browser (anon / authenticated) can read member-facing
-- tables and write nothing; the outbox is invisible to it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(70);

-- RLS is on everywhere
select ok((select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), t || ' has RLS enabled')
from unnest(array[
  'members', 'outings', 'outing_seats', 'outing_reports', 'member_unavailability',
  'events', 'swim_tests', 'swim_test_slots', 'marshal_slots', 'change_log', 'notion_outbox'
]) as t;

-- Fixtures, written as the owner (the server uses the service role, which bypasses RLS)
insert into public.members (id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Test Rower');
insert into public.outings (id, name, type, status, start_at, publish) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Published outing', 'Water Outing', 'Confirmed', now(), true),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Draft outing', 'Water Outing', 'Provisional', now(), false);
insert into public.outing_reports (outing_id, outing_summary) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Good'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Draft');
insert into public.member_unavailability (member_id) values ('aaaaaaaa-0000-4000-8000-000000000001');
insert into public.events (id, title, start_at) values ('eeeeeeee-0000-4000-8000-000000000001', 'Test event', now());
insert into public.swim_tests (id, title, type, start_at)
  values ('cccccccc-0000-4000-8000-000000000001', 'Test swim', 'Swim Test', now());
insert into public.marshal_slots (id, name, start_at, publish) values
  ('dddddddd-0000-4000-8000-000000000001', 'Published shift', now(), true),
  ('dddddddd-0000-4000-8000-000000000002', 'Draft shift', now(), false);
insert into public.change_log (entity, entity_key, after) values ('outing_seats', '{}', '{}');
select public.enqueue_notion_outbox('outing', '{"page_id":"bbbbbbbb-0000-4000-8000-000000000001"}', '{}');

create temporary table public_tables (t text) on commit drop;
insert into public_tables values
  ('members'), ('outings'), ('outing_seats'), ('outing_reports'), ('member_unavailability'),
  ('events'), ('swim_tests'), ('swim_test_slots'), ('marshal_slots'), ('change_log');
grant select on public_tables to anon, authenticated;

-- An UPDATE target column per table (the first column, which every table has)
create temporary table all_tables on commit drop as
select c.table_name::text as t, c.column_name::text as col
  from information_schema.columns c
 where c.table_schema = 'public' and c.ordinal_position = 1
   and c.table_name in ('members', 'outings', 'outing_seats', 'outing_reports', 'member_unavailability',
                        'events', 'swim_tests', 'swim_test_slots', 'marshal_slots', 'change_log', 'notion_outbox');
grant select on all_tables to anon, authenticated;

set local role anon;

select isnt_empty(format('select * from public.%I', t), 'anon can read ' || t) from public_tables;

select throws_ok(format('insert into public.%I default values', t), '42501', null, 'anon cannot insert into ' || t)
from all_tables;
select throws_ok(format('update public.%I set %I = %I', t, col, col), '42501', null, 'anon cannot update ' || t)
from all_tables;
select throws_ok(format('delete from public.%I', t), '42501', null, 'anon cannot delete from ' || t)
from all_tables;
select throws_ok('select * from public.notion_outbox', '42501', null, 'anon cannot read notion_outbox');

-- Unpublished outings / marshal slots, and the seats and reports of unpublished outings, are hidden
select is((select count(*)::int from public.outings where id = 'bbbbbbbb-0000-4000-8000-000000000001'), 1, 'anon sees a published outing');
select is((select count(*)::int from public.outings where id = 'bbbbbbbb-0000-4000-8000-000000000002'), 0, 'anon does not see an unpublished outing');
select is((select count(*)::int from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001'), 14, 'anon sees seats of a published outing');
select is((select count(*)::int from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000002'), 0, 'anon does not see seats of an unpublished outing');
select is((select count(*)::int from public.outing_reports where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001'), 1, 'anon sees the report of a published outing');
select is((select count(*)::int from public.outing_reports where outing_id = 'bbbbbbbb-0000-4000-8000-000000000002'), 0, 'anon does not see the report of an unpublished outing');
select is((select count(*)::int from public.marshal_slots where id = 'dddddddd-0000-4000-8000-000000000001'), 1, 'anon sees a published marshal slot');
select is((select count(*)::int from public.marshal_slots where id = 'dddddddd-0000-4000-8000-000000000002'), 0, 'anon does not see an unpublished marshal slot');

reset role;
set local role authenticated;
select throws_ok('update public.outing_seats set status = ''Reserved''', '42501', null, 'authenticated cannot update seats');
select throws_ok('select * from public.notion_outbox', '42501', null, 'authenticated cannot read notion_outbox');
select is((select count(*)::int from public.outings where id = 'bbbbbbbb-0000-4000-8000-000000000002'), 0, 'authenticated does not see an unpublished outing');
reset role;

-- The service role (used by server routes) sees everything
set local role service_role;
select is((select count(*)::int from public.outings where id = 'bbbbbbbb-0000-4000-8000-000000000002'), 1, 'service_role sees an unpublished outing');
select is((select count(*)::int from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000002'), 14, 'service_role sees seats of an unpublished outing');
select is((select count(*)::int from public.outing_reports where outing_id = 'bbbbbbbb-0000-4000-8000-000000000002'), 1, 'service_role sees the report of an unpublished outing');
select is((select count(*)::int from public.marshal_slots where id = 'dddddddd-0000-4000-8000-000000000002'), 1, 'service_role sees an unpublished marshal slot');
reset role;

select * from finish();
rollback;
