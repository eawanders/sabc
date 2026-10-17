-- RLS and grants: the browser (anon / authenticated) can read member-facing
-- tables and write nothing; the outbox is invisible to it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- RLS is on everywhere
select ok((select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), t || ' has RLS enabled')
from unnest(array[
  'members', 'outings', 'outing_seats', 'outing_reports', 'member_unavailability',
  'events', 'swim_tests', 'swim_test_slots', 'marshal_slots', 'change_log', 'notion_outbox'
]) as t;

-- Fixtures, written as the owner (the server uses the service role, which bypasses RLS)
insert into public.members (id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Test Rower');
insert into public.outings (id, name, type, status, start_at)
  values ('bbbbbbbb-0000-4000-8000-000000000001', 'Test outing', 'Water Outing', 'Confirmed', now());
insert into public.outing_reports (outing_id, outing_summary) values ('bbbbbbbb-0000-4000-8000-000000000001', 'Good');
insert into public.member_unavailability (member_id) values ('aaaaaaaa-0000-4000-8000-000000000001');
insert into public.events (id, title, start_at) values ('eeeeeeee-0000-4000-8000-000000000001', 'Test event', now());
insert into public.swim_tests (id, title, type, start_at)
  values ('cccccccc-0000-4000-8000-000000000001', 'Test swim', 'Swim Test', now());
insert into public.marshal_slots (id, name, start_at) values ('dddddddd-0000-4000-8000-000000000001', 'Test shift', now());
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

reset role;
set local role authenticated;
select throws_ok('update public.outing_seats set status = ''Reserved''', '42501', null, 'authenticated cannot update seats');
select throws_ok('select * from public.notion_outbox', '42501', null, 'authenticated cannot read notion_outbox');
reset role;

select * from finish();
rollback;
