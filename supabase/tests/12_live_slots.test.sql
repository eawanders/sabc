-- PER-276 (B4): swim-test slots, marshal slots, weekly unavailability and outing reports.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into public.members (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Ada'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Ben');
insert into public.outings (id, name, type, status, start_at, publish)
  values ('bbbbbbbb-0000-4000-8000-000000000001', 'Erg', 'Erg Session', 'Provisional', now(), true);
insert into public.swim_tests (id, title, type, start_at)
  values ('cccccccc-0000-4000-8000-000000000001', 'Swim', 'Swim Test', now());
insert into public.marshal_slots (id, name, start_at, publish)
  values ('dddddddd-0000-4000-8000-000000000001', 'Shift', now(), true);

-- ------------------------------------------------------------ claim_test_slot
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 2, 'aaaaaaaa-0000-4000-8000-000000000001',
                                  'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'ok', 'true', 'first slot claim wins');
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 2, 'aaaaaaaa-0000-4000-8000-000000000002',
                                  'aaaaaaaa-0000-4000-8000-000000000002', 0)) - 'current',
  '{"ok": false, "reason": "conflict", "holder_name": "Ada", "updated_by_name": "Ada"}'::jsonb,
  'second claim of the same slot is a conflict naming the holder');
select is((select outcome from public.swim_test_slots where test_id = 'cccccccc-0000-4000-8000-000000000001' and slot = 2),
  'Test Booked', 'a claim books the test');
select is((select payload from public.notion_outbox where done_at is null and entity = 'swim_test'),
  '{"Slot 2": {"relation": [{"id": "aaaaaaaa-0000-4000-8000-000000000001"}]}, "Slot 2 Outcome": {"status": {"name": "Test Booked"}}}'::jsonb,
  'slot patch matches /api/assign-test-slot');
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 7, null,
                                  'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'reason', 'invalid', 'slot 7 is invalid');
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000009', 1, null,
                                  'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'reason', 'not_found', 'unknown test is not_found');

-- ------------------------------------------------------------ set_test_outcome
select is((public.set_test_outcome('cccccccc-0000-4000-8000-000000000001', 2, 'Passed',
                                   'aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002')) ->> 'reason',
  'conflict', 'an outcome for someone no longer in the slot is a conflict');
select is((public.set_test_outcome('cccccccc-0000-4000-8000-000000000001', 2, 'Passed',
                                   'aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001')) ->> 'ok',
  'true', 'outcome set when the member matches');
select is((select payload -> 'Slot 2 Outcome' from public.notion_outbox where done_at is null and entity = 'swim_test'),
  '{"status": {"name": "Passed"}}'::jsonb, 'outcome patch queued');
select is((public.set_test_outcome('cccccccc-0000-4000-8000-000000000001', 2, 'Great',
                                   'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001')) ->> 'reason',
  'invalid', 'unknown outcome is invalid');

-- A passed slot keeps its outcome when re-claimed; clearing marks it No Show (as the route did)
select public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 2, null, 'aaaaaaaa-0000-4000-8000-000000000001', 2);
select is((select outcome from public.swim_test_slots where test_id = 'cccccccc-0000-4000-8000-000000000001' and slot = 2),
  'No Show', 'clearing a slot sets No Show');
select is((select payload -> 'Slot 2' from public.notion_outbox where done_at is null and entity = 'swim_test'),
  '{"relation": []}'::jsonb, 'clearing queues an empty relation');
update public.swim_test_slots set outcome = 'Passed' where test_id = 'cccccccc-0000-4000-8000-000000000001' and slot = 3;
select public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 3, 'aaaaaaaa-0000-4000-8000-000000000002',
                              'aaaaaaaa-0000-4000-8000-000000000002', 1);
select is((select outcome from public.swim_test_slots where test_id = 'cccccccc-0000-4000-8000-000000000001' and slot = 3),
  'Passed', 'claiming a slot already marked Passed keeps the outcome');

-- ------------------------------------------------------------ claim_marshal_slot
select is((public.claim_marshal_slot('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
                                     'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'ok', 'true', 'marshal sign-up');
select is((select person_status from public.marshal_slots where id = 'dddddddd-0000-4000-8000-000000000001'),
  'Confirmed', 'a sign-up is Confirmed');
select is((select payload from public.notion_outbox where done_at is null and entity = 'marshal_slot'),
  '{"Person": {"relation": [{"id": "aaaaaaaa-0000-4000-8000-000000000001"}]}, "Person Status": {"select": {"name": "Confirmed"}}}'::jsonb,
  'marshal patch matches /api/assign-marshal (Person Status is a select)');
select is((public.claim_marshal_slot('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
                                     'aaaaaaaa-0000-4000-8000-000000000002', 0)) ->> 'holder_name', 'Ada', 'the loser is told who has it');
select is((public.claim_marshal_slot('dddddddd-0000-4000-8000-000000000001', null,
                                     'aaaaaaaa-0000-4000-8000-000000000001', 1)) -> 'row' ->> 'person_status', 'Open', 'clearing reopens the slot');
select is((select payload -> 'Person Status' from public.notion_outbox where done_at is null and entity = 'marshal_slot'),
  '{"select": {"name": "Open"}}'::jsonb, 'Open queued');

-- ------------------------------------------------------------ save_unavailability
-- Ben has no row yet: the client saw version 0
select is((public.save_unavailability('aaaaaaaa-0000-4000-8000-000000000002',
          '{"monday": [{"start": "09:00", "end": "12:00"}], "tuesday": [], "wednesday": [], "thursday": [], "friday": [], "saturday": [], "sunday": []}',
          'aaaaaaaa-0000-4000-8000-000000000002', 0)) ->> 'ok', 'true', 'first save creates the row');
select is((select monday from public.member_unavailability where member_id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  '[{"start": "09:00", "end": "12:00"}]'::jsonb, 'saved');
select is((select payload -> 'Unavailable Monday' from public.notion_outbox where done_at is null and entity = 'member'),
  '{"type": "rich_text", "rich_text": [{"type": "text", "text": {"content": "[{\"start\":\"09:00\",\"end\":\"12:00\"}]"}}]}'::jsonb,
  'Notion text is what stringifyTimeRanges writes');
select is((select payload -> 'Unavailable Sunday' -> 'rich_text' -> 0 -> 'text' ->> 'content' from public.notion_outbox
            where done_at is null and entity = 'member'), '[]', 'an empty day is "[]"');
select is((public.save_unavailability('aaaaaaaa-0000-4000-8000-000000000002', '{"monday": []}',
          'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'reason', 'conflict', 'a stale save is a conflict');
select is((public.save_unavailability('aaaaaaaa-0000-4000-8000-000000000002', '{"funday": []}',
          'aaaaaaaa-0000-4000-8000-000000000002', 1)) ->> 'reason', 'invalid', 'unknown day is invalid');
select is((public.save_unavailability('aaaaaaaa-0000-4000-8000-000000000002', '{"monday": "09:00"}',
          'aaaaaaaa-0000-4000-8000-000000000002', 1)) ->> 'reason', 'invalid', 'a day must be an array');

-- ------------------------------------------------------------ save_outing_report
select is((public.save_outing_report('bbbbbbbb-0000-4000-8000-000000000001', '{"outing_summary": "Good", "boat_feel": "Set"}',
          'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'ok', 'true', 'first report save creates the row');
select is((select payload from public.notion_outbox where done_at is null and entity = 'outing'),
  '{"Outing Summary": {"rich_text": [{"type": "text", "text": {"content": "Good"}}]},
    "Boat Feel": {"rich_text": [{"type": "text", "text": {"content": "Set"}}]}}'::jsonb,
  'only the fields sent are patched, as /api/submit-outing-report does');
select is((public.save_outing_report('bbbbbbbb-0000-4000-8000-000000000001', '{"next_focus": "Catch"}',
          'aaaaaaaa-0000-4000-8000-000000000002', 0)) ->> 'updated_by_name', 'Ada', 'a stale report save names who changed it');
select is((public.save_outing_report('bbbbbbbb-0000-4000-8000-000000000001', '{"version": 9}',
          'aaaaaaaa-0000-4000-8000-000000000001', 1)) ->> 'reason', 'invalid', 'only report fields may be written');

select * from finish();
rollback;
