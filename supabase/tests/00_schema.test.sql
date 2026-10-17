-- Schema: tables, keys, constraints and the row-level triggers.
begin;
create extension if not exists pgtap with schema extensions;
select plan(64);

-- Tables
select has_table('public', t, t || ' exists')
from unnest(array[
  'members', 'outings', 'outing_seats', 'outing_reports', 'member_unavailability',
  'events', 'swim_tests', 'swim_test_slots', 'marshal_slots', 'change_log', 'notion_outbox'
]) as t;

-- Primary keys
select col_is_pk('public', 'members', 'id', 'members pk');
select col_is_pk('public', 'outings', 'id', 'outings pk');
select col_is_pk('public', 'outing_seats', array['outing_id', 'seat'], 'outing_seats pk');
select col_is_pk('public', 'outing_reports', 'outing_id', 'outing_reports pk');
select col_is_pk('public', 'member_unavailability', 'member_id', 'member_unavailability pk');
select col_is_pk('public', 'events', 'id', 'events pk');
select col_is_pk('public', 'swim_tests', 'id', 'swim_tests pk');
select col_is_pk('public', 'swim_test_slots', array['test_id', 'slot'], 'swim_test_slots pk');
select col_is_pk('public', 'marshal_slots', 'id', 'marshal_slots pk');
select col_is_pk('public', 'change_log', 'id', 'change_log pk');
select col_is_pk('public', 'notion_outbox', 'id', 'notion_outbox pk');

-- App-owned rows carry version / updated_by / updated_at
select has_column('public', t, c, t || '.' || c)
from unnest(array['outing_seats', 'outing_reports', 'member_unavailability', 'swim_test_slots', 'marshal_slots']) as t,
     unnest(array['version', 'updated_by', 'updated_at']) as c;

-- Synced-from-Notion tables carry sync bookkeeping
select has_column('public', t, 'notion_last_edited_at', t || '.notion_last_edited_at')
from unnest(array['members', 'outings', 'events', 'swim_tests', 'marshal_slots']) as t;

-- Members hold no personal contact data
select hasnt_column('public', 'members', c, 'members has no ' || c)
from unnest(array['email', 'phone', 'date_of_birth', 'dob']) as c;

-- Fixtures
insert into public.members (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Test Rower'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Other Rower');
insert into public.outings (id, name, type, status, start_at)
  values ('bbbbbbbb-0000-4000-8000-000000000001', 'Test outing', 'Water Outing', 'Provisional', now());
insert into public.swim_tests (id, title, type, start_at)
  values ('cccccccc-0000-4000-8000-000000000001', 'Test swim', 'Swim Test', now());

-- Seats and slots are created with their parent
select is((select count(*)::int from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  14, 'a new outing gets its 14 seat rows');
select is((select count(*)::int from public.swim_test_slots where test_id = 'cccccccc-0000-4000-8000-000000000001'),
  6, 'a new swim test gets its 6 slot rows');

-- Invalid values are rejected
select throws_ok($$ insert into public.members (id, name) values ('not-a-notion-id', 'x') $$,
  '23514', null, 'non-uuid id rejected');
select throws_ok($$ insert into public.members (id, name) values ('AAAAAAAA-0000-4000-8000-000000000009', 'x') $$,
  '23514', null, 'upper-case id rejected (canonical form is lower-case)');
select throws_ok($$ insert into public.members (id, name) values ('aaaaaaaa00004000800000000000000a', 'x') $$,
  '23514', null, 'unhyphenated id rejected');
select throws_ok($$ insert into public.outing_seats (outing_id, seat) values ('bbbbbbbb-0000-4000-8000-000000000001', '8 Seat') $$,
  '23514', null, 'invalid seat name rejected');
select throws_ok($$ update public.outing_seats set status = 'Booked' where seat = 'Bow' $$,
  '23514', null, 'invalid seat status rejected');
select throws_ok($$ update public.outings set type = 'Swim' $$,
  '23514', null, 'invalid outing type rejected');
select throws_ok($$ update public.outings set status = 'Maybe' $$,
  '23514', null, 'invalid outing status rejected');
select throws_ok($$ insert into public.swim_test_slots (test_id, slot) values ('cccccccc-0000-4000-8000-000000000001', 7) $$,
  '23514', null, 'slot 7 rejected');
select throws_ok($$ update public.swim_test_slots set outcome = 'Pending' where slot = 1 $$,
  '23514', null, 'invalid test outcome rejected');
select throws_ok($$ insert into public.marshal_slots (id, name, start_at, person_status) values ('dddddddd-0000-4000-8000-000000000001', 'x', now(), 'Maybe') $$,
  '23514', null, 'invalid marshal person status rejected');
select throws_ok($$ insert into public.member_unavailability (member_id, monday) values ('aaaaaaaa-0000-4000-8000-000000000001', '{"start":"09:00"}') $$,
  '23514', null, 'unavailability day must be a JSON array');
select throws_ok($$ update public.outing_seats set member_id = 'aaaaaaaa-0000-4000-8000-00000000ffff' where seat = 'Bow' $$,
  '23503', null, 'seat member must exist');

-- Every write bumps version and stamps updated_at
update public.outing_seats
   set member_id = 'aaaaaaaa-0000-4000-8000-000000000001', status = 'Available',
       updated_by = 'aaaaaaaa-0000-4000-8000-000000000001'
 where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Bow';
select is((select version from public.outing_seats where seat = 'Bow' and outing_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  1, 'update bumps seat version');
update public.outing_seats set status = 'Reserved'
 where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Bow';
select is((select version from public.outing_seats where seat = 'Bow' and outing_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  2, 'second update bumps version again');

-- First claim wins: a compare-and-set on version only succeeds once
prepare claim as
  update public.outing_seats set member_id = $1
   where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Stroke' and version = 0;
execute claim('aaaaaaaa-0000-4000-8000-000000000001');
select is((select member_id from public.outing_seats where seat = 'Stroke' and outing_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'aaaaaaaa-0000-4000-8000-000000000001', 'first claimant holds the seat');
execute claim('aaaaaaaa-0000-4000-8000-000000000002');
select is((select member_id from public.outing_seats where seat = 'Stroke' and outing_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'aaaaaaaa-0000-4000-8000-000000000001', 'second claim with stale version changes nothing');

select * from finish();
rollback;
