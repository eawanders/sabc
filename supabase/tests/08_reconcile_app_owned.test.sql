-- PER-275 follow-up: app-owned fields reconciled from Notion by the inbound sync.
-- Per field: equal -> nothing; pending outbox key -> keep DB; last app write newer
-- than the Notion edit -> keep DB (reported); else take Notion's value, logged
-- with source 'notion', actor null, no outbox echo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(66);

insert into public.members (id, name) values
  ('ffffffff-0000-4000-8000-000000000001', 'Ada'),
  ('ffffffff-0000-4000-8000-000000000002', 'Ben'),
  ('ffffffff-0000-4000-8000-000000000003', 'Cora'),
  ('ffffffff-0000-4000-8000-000000000004', 'Dev');
insert into public.outings (id, name, type, status, start_at, publish) values
  ('ffffffff-0000-4000-8000-000000000101', 'Water', 'Water Outing', 'Provisional', now(), true),
  ('ffffffff-0000-4000-8000-000000000102', 'Erg', 'Erg Session', 'Provisional', now(), true);
insert into public.swim_tests (id, title) values ('ffffffff-0000-4000-8000-000000000201', 'Swim test');
insert into public.marshal_slots (id, name, publish) values ('ffffffff-0000-4000-8000-000000000301', 'Shift', true);

create temp table r (name text primary key, res jsonb);

create function pg_temp.seats(p_outing text, p_edited timestamptz, p_seats jsonb) returns jsonb
language sql as $$
  select public.sync_reconcile_seats(jsonb_build_array(jsonb_build_object(
    'outing_id', p_outing, 'edited_at', p_edited, 'seats', p_seats)));
$$;

create function pg_temp.seat(p_seat text) returns public.outing_seats
language sql as $$
  select * from public.outing_seats where outing_id = 'ffffffff-0000-4000-8000-000000000101' and seat = p_seat;
$$;

create function pg_temp.pending(p_page text) returns integer
language sql as $$
  select count(*)::int from public.notion_outbox where entity_key ->> 'page_id' = p_page and done_at is null;
$$;

-- ================================================================ seats
-- take: rows last written by the sync (updated_by null) never count as newer than Notion
insert into r values ('seat take', pg_temp.seats('ffffffff-0000-4000-8000-000000000101', now() - interval '1 day',
  '[{"seat": "Bow", "member_id": "ffffffff-0000-4000-8000-000000000001", "status": "Available"}]'));
select is((select res ->> 'rows' from r where name = 'seat take'), '1', 'seats: a Notion change is taken');
select is((pg_temp.seat('Bow')).member_id::text, 'ffffffff-0000-4000-8000-000000000001', 'seats: member from Notion');
select is((pg_temp.seat('Bow')).status, 'Available', 'seats: status from Notion');
select is((pg_temp.seat('Bow')).version, 1, 'seats: version bumps');
select is((pg_temp.seat('Bow')).updated_by::text, null, 'seats: updated_by is cleared');
select ok((select source = 'notion' and actor_member_id is null and entity = 'outing_seats'
                  and entity_key = '{"outing_id": "ffffffff-0000-4000-8000-000000000101", "seat": "Bow"}'::jsonb
                  and before ->> 'member_id' is null and after ->> 'member_id' = 'ffffffff-0000-4000-8000-000000000001'
             from public.change_log where entity_key ->> 'outing_id' = 'ffffffff-0000-4000-8000-000000000101'),
  'seats: one change_log row, source notion, actor null, before/after images');
select is(pg_temp.pending('ffffffff-0000-4000-8000-000000000101'), 0, 'seats: nothing is queued back to Notion (no echo)');

-- equal
insert into r values ('seat equal', pg_temp.seats('ffffffff-0000-4000-8000-000000000101', now() + interval '1 hour',
  '[{"seat": "Bow", "member_id": "ffffffff-0000-4000-8000-000000000001", "status": "Available"}]'));
select is((select res ->> 'rows' from r where name = 'seat equal'), '0', 'seats: equal values change nothing');
select is((pg_temp.seat('Bow')).version, 1, 'seats: equal values do not bump the version');

-- pending: the app claimed 2 Seat; its patch is still queued
select public.claim_seat('ffffffff-0000-4000-8000-000000000101', '2 Seat', 'ffffffff-0000-4000-8000-000000000002',
                         'Available', 'ffffffff-0000-4000-8000-000000000002', 0);
insert into r values ('seat pending', pg_temp.seats('ffffffff-0000-4000-8000-000000000101', now() + interval '1 hour',
  '[{"seat": "2 Seat", "member_id": "ffffffff-0000-4000-8000-000000000003", "status": "Reserved"}]'));
select is((select res ->> 'kept_pending' from r where name = 'seat pending'), '2', 'seats: pending member and status are kept');
select is((pg_temp.seat('2 Seat')).member_id::text, 'ffffffff-0000-4000-8000-000000000002', 'seats: the app''s in-flight member stays');

-- newer: the patch was sent, but this Notion snapshot predates the app write
update public.notion_outbox set done_at = now() where done_at is null;
insert into r values ('seat newer', pg_temp.seats('ffffffff-0000-4000-8000-000000000101', now() - interval '1 hour',
  '[{"seat": "2 Seat", "member_id": "ffffffff-0000-4000-8000-000000000003", "status": "Available"}]'));
select is((select res -> 'kept_newer' from r where name = 'seat newer'),
  '[{"entity": "outing_seats", "key": {"outing_id": "ffffffff-0000-4000-8000-000000000101", "seat": "2 Seat"}, "field": "member_id"}]'::jsonb,
  'seats: an app write newer than the Notion edit is kept and reported');
select is((pg_temp.seat('2 Seat')).member_id::text, 'ffffffff-0000-4000-8000-000000000002', 'seats: newer app value stays');

-- a later Notion edit (the current app changed it) is taken
insert into r values ('seat later', pg_temp.seats('ffffffff-0000-4000-8000-000000000101', now() + interval '1 minute',
  '[{"seat": "2 Seat", "member_id": "ffffffff-0000-4000-8000-000000000003", "status": "Available"}]'));
select is((pg_temp.seat('2 Seat')).member_id::text, 'ffffffff-0000-4000-8000-000000000003', 'seats: a later Notion edit is taken');

-- per field: only the status is pending
select public.enqueue_notion_outbox('outing', '{"page_id": "ffffffff-0000-4000-8000-000000000101"}',
  '{"3 Seat Status": {"status": {"name": "Maybe Available"}}}');
update public.outing_seats set status = 'Maybe Available'
 where outing_id = 'ffffffff-0000-4000-8000-000000000101' and seat = '3 Seat';
insert into r values ('seat per field', pg_temp.seats('ffffffff-0000-4000-8000-000000000101', now() + interval '1 minute',
  '[{"seat": "3 Seat", "member_id": "ffffffff-0000-4000-8000-000000000004", "status": "Not Available"}]'));
select ok((pg_temp.seat('3 Seat')).member_id = 'ffffffff-0000-4000-8000-000000000004'
          and (pg_temp.seat('3 Seat')).status = 'Maybe Available',
  'seats: decided per field (member taken, pending status kept)');
select is((select payload from public.notion_outbox
            where entity_key ->> 'page_id' = 'ffffffff-0000-4000-8000-000000000101' and done_at is null),
  '{"3 Seat Status": {"status": {"name": "Maybe Available"}}}'::jsonb, 'seats: the pending patch is untouched');
update public.notion_outbox set done_at = now() where done_at is null;

-- one member, one seat: a mid-edit snapshot showing Ada in Bow and Stroke
insert into r values ('seat dup', pg_temp.seats('ffffffff-0000-4000-8000-000000000101', now() + interval '2 minutes',
  '[{"seat": "Bow", "member_id": "ffffffff-0000-4000-8000-000000000001", "status": "Available"},
    {"seat": "Stroke", "member_id": "ffffffff-0000-4000-8000-000000000001", "status": "Available"},
    {"seat": "Cox", "member_id": "ffffffff-0000-4000-8000-000000000002", "status": "Available"}]'));
select is((pg_temp.seat('Stroke')).member_id::text, null, 'seats: a move that would seat a member twice is skipped');
select is((select res -> 'skipped' -> 0 ->> 'reason' from r where name = 'seat dup'), 'would put one member in two seats',
  'seats: the skip is reported');
select is((pg_temp.seat('Cox')).member_id::text, 'ffffffff-0000-4000-8000-000000000002',
  'seats: the rest of the outing still applies');

-- a move between seats applies together (Ada Bow -> Stroke, Dev 3 Seat -> Bow)
insert into r values ('seat move', pg_temp.seats('ffffffff-0000-4000-8000-000000000101', now() + interval '3 minutes',
  '[{"seat": "Bow", "member_id": "ffffffff-0000-4000-8000-000000000004", "status": "Available"},
    {"seat": "Stroke", "member_id": "ffffffff-0000-4000-8000-000000000001", "status": "Available"},
    {"seat": "3 Seat", "member_id": null, "status": "Maybe Available"}]'));
select is((select res ->> 'rows' from r where name = 'seat move'), '3', 'seats: a three-seat shuffle applies together');
select ok((pg_temp.seat('Bow')).member_id = 'ffffffff-0000-4000-8000-000000000004'
          and (pg_temp.seat('Stroke')).member_id = 'ffffffff-0000-4000-8000-000000000001'
          and (pg_temp.seat('3 Seat')).member_id is null, 'seats: members moved');
select is((select count(*)::int from (select member_id from public.outing_seats
            where outing_id = 'ffffffff-0000-4000-8000-000000000101' and member_id is not null
            group by member_id having count(*) > 1) d), 0, 'seats: no member holds two seats');

-- unknown member and unknown seat are skipped, not errors
insert into r values ('seat unknown', pg_temp.seats('ffffffff-0000-4000-8000-000000000101', now() + interval '4 minutes',
  '[{"seat": "Sub 4", "member_id": "ffffffff-0000-4000-8000-000000000999", "status": "Available"},
    {"seat": "Sub 9", "member_id": null, "status": null}]'));
select is((select jsonb_agg(e ->> 'reason' order by e ->> 'reason') from r, jsonb_array_elements(res -> 'skipped') e
            where name = 'seat unknown'), '["unknown member", "unknown seat"]'::jsonb, 'seats: unknown member / seat are skipped');
select is((pg_temp.seat('Sub 4')).member_id::text, null, 'seats: a relation to an unknown member is not applied');

-- one bad page does not stop the batch
insert into r values ('seat batch', public.sync_reconcile_seats(jsonb_build_array(
  jsonb_build_object('outing_id', 'ffffffff-0000-4000-8000-000000000999', 'edited_at', now(), 'seats', '[]'::jsonb),
  jsonb_build_object('outing_id', 'ffffffff-0000-4000-8000-000000000102', 'edited_at', 'not a time', 'seats', '[]'::jsonb),
  jsonb_build_object('outing_id', 'ffffffff-0000-4000-8000-000000000102', 'edited_at', now(),
    'seats', '[{"seat": "Cox", "member_id": "ffffffff-0000-4000-8000-000000000003", "status": "Available"}]'::jsonb))));
select is((select jsonb_array_length(res -> 'skipped') from r where name = 'seat batch'), 2, 'seats: bad pages are reported');
select is((select member_id::text from public.outing_seats
            where outing_id = 'ffffffff-0000-4000-8000-000000000102' and seat = 'Cox'),
  'ffffffff-0000-4000-8000-000000000003', 'seats: the good page in the same batch applies');

-- Notion's changes cannot be undone by anyone
select is(public.undo_change((select max(id) from public.change_log where source = 'notion'),
                             'ffffffff-0000-4000-8000-000000000001') ->> 'reason',
  'forbidden', 'a change taken from Notion is not undoable');
select ok((select bool_and(source = 'app') from public.change_log where actor_member_id is not null),
  'app writes are logged with source app');

-- ================================================================ swim-test slots
create function pg_temp.slots(p_edited timestamptz, p_slots jsonb) returns jsonb
language sql as $$
  select public.sync_reconcile_test_slots(jsonb_build_array(jsonb_build_object(
    'test_id', 'ffffffff-0000-4000-8000-000000000201', 'edited_at', p_edited, 'slots', p_slots)));
$$;
create function pg_temp.slot(p_slot int) returns public.swim_test_slots
language sql as $$
  select * from public.swim_test_slots where test_id = 'ffffffff-0000-4000-8000-000000000201' and slot = p_slot;
$$;

insert into r values ('slot take', pg_temp.slots(now() - interval '1 day',
  '[{"slot": 2, "member_id": "ffffffff-0000-4000-8000-000000000002", "outcome": "Test Booked"}]'));
select ok((pg_temp.slot(2)).member_id = 'ffffffff-0000-4000-8000-000000000002' and (pg_temp.slot(2)).outcome = 'Test Booked'
          and (pg_temp.slot(2)).updated_by is null and (pg_temp.slot(2)).version = 1, 'slots: a Notion change is taken');
select ok((select source = 'notion' and actor_member_id is null from public.change_log
            where entity = 'swim_test_slots' and entity_key = '{"test_id": "ffffffff-0000-4000-8000-000000000201", "slot": 2}'),
  'slots: logged as a Notion change');
select is(pg_temp.pending('ffffffff-0000-4000-8000-000000000201'), 0, 'slots: no echo');

select public.set_test_outcome('ffffffff-0000-4000-8000-000000000201', 2, 'Passed',
                               'ffffffff-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000002');
insert into r values ('slot pending', pg_temp.slots(now() + interval '1 hour',
  '[{"slot": 2, "member_id": "ffffffff-0000-4000-8000-000000000002", "outcome": "Failed"}]'));
select ok((select (res ->> 'kept_pending')::int = 1 from r where name = 'slot pending') and (pg_temp.slot(2)).outcome = 'Passed',
  'slots: a pending outcome is kept');
update public.notion_outbox set done_at = now() where done_at is null;
insert into r values ('slot newer', pg_temp.slots(now() - interval '1 hour',
  '[{"slot": 2, "member_id": "ffffffff-0000-4000-8000-000000000002", "outcome": "Failed"}]'));
select ok((select jsonb_array_length(res -> 'kept_newer') = 1 from r where name = 'slot newer') and (pg_temp.slot(2)).outcome = 'Passed',
  'slots: a newer app outcome is kept');
insert into r values ('slot later', pg_temp.slots(now() + interval '1 minute',
  '[{"slot": 2, "member_id": "ffffffff-0000-4000-8000-000000000002", "outcome": "Failed"}]'));
select is((pg_temp.slot(2)).outcome, 'Failed', 'slots: a later Notion edit is taken');
insert into r values ('slot bad', pg_temp.slots(now() + interval '2 minutes', '[{"slot": 3, "member_id": null, "outcome": "Drowned"}]'));
select ok((select res -> 'skipped' -> 0 ->> 'reason' = 'unknown outcome' from r where name = 'slot bad')
          and (pg_temp.slot(3)).outcome is null, 'slots: an unknown outcome is skipped');

-- ================================================================ marshal sign-ups
create function pg_temp.marshal(p_edited timestamptz, p_person text, p_status text) returns jsonb
language sql as $$
  select public.sync_reconcile_marshal_slots(jsonb_build_array(jsonb_build_object(
    'id', 'ffffffff-0000-4000-8000-000000000301', 'edited_at', p_edited, 'person_id', p_person, 'person_status', p_status)));
$$;
create function pg_temp.shift() returns public.marshal_slots
language sql as $$ select * from public.marshal_slots where id = 'ffffffff-0000-4000-8000-000000000301'; $$;

insert into r values ('marshal take', pg_temp.marshal(now() - interval '1 day', 'ffffffff-0000-4000-8000-000000000003', 'Confirmed'));
select ok((pg_temp.shift()).person_id = 'ffffffff-0000-4000-8000-000000000003' and (pg_temp.shift()).person_status = 'Confirmed'
          and (pg_temp.shift()).updated_by is null and (pg_temp.shift()).version = 1, 'marshal: a Notion change is taken');
select ok((select source = 'notion' and actor_member_id is null from public.change_log where entity = 'marshal_slots'
            and entity_key = '{"id": "ffffffff-0000-4000-8000-000000000301"}'), 'marshal: logged as a Notion change');
select is(pg_temp.pending('ffffffff-0000-4000-8000-000000000301'), 0, 'marshal: no echo');
insert into r values ('marshal equal', pg_temp.marshal(now() + interval '1 hour', 'ffffffff-0000-4000-8000-000000000003', 'Confirmed'));
select is((select res ->> 'rows' from r where name = 'marshal equal'), '0', 'marshal: equal values change nothing');

select public.claim_marshal_slot('ffffffff-0000-4000-8000-000000000301', null, 'ffffffff-0000-4000-8000-000000000003', 1);
insert into r values ('marshal pending', pg_temp.marshal(now() + interval '1 hour', 'ffffffff-0000-4000-8000-000000000004', 'Reserved'));
select ok((select (res ->> 'kept_pending')::int = 2 from r where name = 'marshal pending')
          and (pg_temp.shift()).person_id is null, 'marshal: a pending sign-up is kept');
update public.notion_outbox set done_at = now() where done_at is null;
insert into r values ('marshal newer', pg_temp.marshal(now() - interval '1 hour', 'ffffffff-0000-4000-8000-000000000004', 'Reserved'));
select ok((select jsonb_array_length(res -> 'kept_newer') = 2 from r where name = 'marshal newer')
          and (pg_temp.shift()).person_id is null, 'marshal: a newer app sign-up is kept');
insert into r values ('marshal later', pg_temp.marshal(now() + interval '1 minute', 'ffffffff-0000-4000-8000-000000000004', 'Reserved'));
select is((pg_temp.shift()).person_id::text, 'ffffffff-0000-4000-8000-000000000004', 'marshal: a later Notion edit is taken');

-- ================================================================ weekly unavailability
create function pg_temp.unavail(p_member text, p_edited timestamptz, p_days jsonb) returns jsonb
language sql as $$
  select public.sync_reconcile_unavailability(jsonb_build_array(jsonb_build_object(
    'member_id', p_member, 'edited_at', p_edited, 'days', p_days)));
$$;
create function pg_temp.week(p_member text) returns public.member_unavailability
language sql as $$ select * from public.member_unavailability where member_id = p_member; $$;

insert into r values ('unavail empty', pg_temp.unavail('ffffffff-0000-4000-8000-000000000001', now(), '{}'));
select is((pg_temp.week('ffffffff-0000-4000-8000-000000000001')).member_id::text, null,
  'unavailability: an empty Notion week creates no row');
insert into r values ('unavail take', pg_temp.unavail('ffffffff-0000-4000-8000-000000000001', now() - interval '1 day',
  '{"monday": [{"start": "09:00", "end": "12:00"}]}'));
select ok((pg_temp.week('ffffffff-0000-4000-8000-000000000001')).monday = '[{"start": "09:00", "end": "12:00"}]'::jsonb
          and (pg_temp.week('ffffffff-0000-4000-8000-000000000001')).tuesday = '[]'::jsonb
          and (pg_temp.week('ffffffff-0000-4000-8000-000000000001')).updated_by is null,
  'unavailability: a Notion week creates the row');
select ok((select source = 'notion' and actor_member_id is null from public.change_log where entity = 'member_unavailability'
            and entity_key = '{"member_id": "ffffffff-0000-4000-8000-000000000001"}'), 'unavailability: logged as a Notion change');
select is(pg_temp.pending('ffffffff-0000-4000-8000-000000000001'), 0, 'unavailability: no echo');
insert into r values ('unavail equal', pg_temp.unavail('ffffffff-0000-4000-8000-000000000001', now() + interval '1 hour',
  '{"monday": [{"end": "12:00", "start": "09:00", "label": "ignored"}], "tuesday": []}'));
select is((select res ->> 'rows' from r where name = 'unavail equal'), '0', 'unavailability: compared on {start, end} only');

select public.save_unavailability('ffffffff-0000-4000-8000-000000000001',
  '{"monday": [], "tuesday": [{"start": "18:00", "end": "20:00"}], "wednesday": [], "thursday": [], "friday": [], "saturday": [], "sunday": []}',
  'ffffffff-0000-4000-8000-000000000001',
  (pg_temp.week('ffffffff-0000-4000-8000-000000000001')).version);
insert into r values ('unavail pending', pg_temp.unavail('ffffffff-0000-4000-8000-000000000001', now() + interval '1 hour',
  '{"monday": [{"start": "09:00", "end": "12:00"}]}'));
select ok((select (res ->> 'kept_pending')::int = 2 from r where name = 'unavail pending')
          and (pg_temp.week('ffffffff-0000-4000-8000-000000000001')).tuesday = '[{"start": "18:00", "end": "20:00"}]'::jsonb,
  'unavailability: pending days are kept');
update public.notion_outbox set done_at = now() where done_at is null;
insert into r values ('unavail newer', pg_temp.unavail('ffffffff-0000-4000-8000-000000000001', now() - interval '1 hour',
  '{"monday": [{"start": "09:00", "end": "12:00"}]}'));
select is((select jsonb_array_length(res -> 'kept_newer') from r where name = 'unavail newer'), 2,
  'unavailability: newer app days are kept and reported');
insert into r values ('unavail later', pg_temp.unavail('ffffffff-0000-4000-8000-000000000001', now() + interval '1 minute',
  '{"wednesday": [{"start": "07:00", "end": "08:00"}], "tuesday": [{"start": "18:00", "end": "20:00"}]}'));
select ok((pg_temp.week('ffffffff-0000-4000-8000-000000000001')).wednesday = '[{"start": "07:00", "end": "08:00"}]'::jsonb
          and (pg_temp.week('ffffffff-0000-4000-8000-000000000001')).tuesday = '[{"start": "18:00", "end": "20:00"}]'::jsonb,
  'unavailability: a later Notion edit is taken');
insert into r values ('unavail unknown', pg_temp.unavail('ffffffff-0000-4000-8000-000000000999', now(),
  '{"monday": [{"start": "09:00", "end": "10:00"}]}'));
select ok((select res = public.sync_result_new() from r where name = 'unavail unknown'),
  'unavailability: members that are not synced are ignored');

-- ================================================================ outing reports
create function pg_temp.report(p_edited timestamptz, p_fields jsonb) returns jsonb
language sql as $$
  select public.sync_reconcile_reports(jsonb_build_array(jsonb_build_object(
    'outing_id', 'ffffffff-0000-4000-8000-000000000101', 'edited_at', p_edited, 'fields', p_fields)));
$$;
create function pg_temp.rep() returns public.outing_reports
language sql as $$ select * from public.outing_reports where outing_id = 'ffffffff-0000-4000-8000-000000000101'; $$;

insert into r values ('report none', pg_temp.report(now(), '{"outing_summary": "", "boat_feel": null}'));
select is((pg_temp.rep()).outing_id::text, null, 'reports: an empty Notion report creates no row');
insert into r values ('report take', pg_temp.report(now() - interval '1 day', '{"outing_summary": "Solid", "coach_feedback": "Sit up"}'));
select ok((pg_temp.rep()).outing_summary = 'Solid' and (pg_temp.rep()).coach_feedback = 'Sit up'
          and (pg_temp.rep()).boat_feel is null and (pg_temp.rep()).updated_by is null, 'reports: a Notion report creates the row');
select ok((select source = 'notion' from public.change_log where entity = 'outing_reports'), 'reports: logged as a Notion change');
select is(pg_temp.pending('ffffffff-0000-4000-8000-000000000101'), 0, 'reports: no echo');
insert into r values ('report equal', pg_temp.report(now() + interval '1 hour',
  '{"outing_summary": "  Solid ", "coach_feedback": "Sit up", "boat_feel": ""}'));
select is((select res ->> 'rows' from r where name = 'report equal'), '0', 'reports: whitespace and empty text compare equal');

select public.save_outing_report('ffffffff-0000-4000-8000-000000000101', '{"boat_feel": "Light"}',
                                 'ffffffff-0000-4000-8000-000000000002', (pg_temp.rep()).version);
insert into r values ('report pending', pg_temp.report(now() + interval '1 hour',
  '{"outing_summary": "Solid", "coach_feedback": "Sit up", "boat_feel": "Heavy"}'));
select ok((select (res ->> 'kept_pending')::int = 1 from r where name = 'report pending') and (pg_temp.rep()).boat_feel = 'Light',
  'reports: a pending field is kept');
update public.notion_outbox set done_at = now() where done_at is null;
insert into r values ('report newer', pg_temp.report(now() - interval '1 hour',
  '{"outing_summary": "Solid", "coach_feedback": "Sit up", "boat_feel": "Heavy"}'));
select ok((select jsonb_array_length(res -> 'kept_newer') = 1 from r where name = 'report newer') and (pg_temp.rep()).boat_feel = 'Light',
  'reports: a newer app field is kept');
insert into r values ('report later', pg_temp.report(now() + interval '1 minute',
  '{"outing_summary": "Solid", "coach_feedback": "Sit up", "boat_feel": "Heavy"}'));
select is((pg_temp.rep()).boat_feel, 'Heavy', 'reports: a later Notion edit is taken');
select is(pg_temp.pending('ffffffff-0000-4000-8000-000000000101'), 0, 'no reconcile in this file queued anything for Notion');

-- ================================================================ grants
select ok(has_function_privilege('service_role', 'public.sync_reconcile_seats(jsonb)', 'execute')
          and has_function_privilege('service_role', 'public.sync_reconcile_test_slots(jsonb)', 'execute')
          and has_function_privilege('service_role', 'public.sync_reconcile_marshal_slots(jsonb)', 'execute')
          and has_function_privilege('service_role', 'public.sync_reconcile_unavailability(jsonb)', 'execute')
          and has_function_privilege('service_role', 'public.sync_reconcile_reports(jsonb)', 'execute'),
  'the service role can run the five reconcile functions');
select ok(not has_function_privilege('anon', 'public.sync_reconcile_seats(jsonb)', 'execute')
          and not has_function_privilege('authenticated', 'public.sync_reconcile_reports(jsonb)', 'execute'),
  'anon and authenticated cannot');
select ok(not has_function_privilege('service_role', 'public.sync_reconcile_outing_seats(jsonb, jsonb)', 'execute')
          and not has_function_privilege('service_role', 'public.sync_log(text, jsonb, jsonb, jsonb)', 'execute'),
  'the internal helpers are not callable directly');
select col_default_is('public', 'change_log', 'source', 'app'::text, 'change_log.source defaults to app');
select ok((select prosecdef from pg_proc where proname = 'sync_reconcile_seats'), 'entry points are security definer');
select ok((select count(*) = 0 from pg_proc where proname like 'sync\_reconcile\_%' and prosecdef
             and not ('search_path=""' = any (proconfig))), 'every security-definer reconcile function pins search_path');

select * from finish();
rollback;
