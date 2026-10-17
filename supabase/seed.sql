-- Local development seed: a small, entirely made-up club. No real member data.
-- Ids are fake Notion page ids in canonical form.

insert into public.members (id, name, member_type, cox_experience) values
  ('00000000-0000-4000-8000-000000000001', 'Ada Oarsworth',   '{College Rower,Member}', null),
  ('00000000-0000-4000-8000-000000000002', 'Ben Blade',       '{College Rower,Member}', null),
  ('00000000-0000-4000-8000-000000000003', 'Cora Catch',      '{College Rower,Member}', null),
  ('00000000-0000-4000-8000-000000000004', 'Dev Drive',       '{College Rower,Member}', null),
  ('00000000-0000-4000-8000-000000000005', 'Eve Feather',     '{College Rower,Member}', null),
  ('00000000-0000-4000-8000-000000000006', 'Finn Finish',     '{College Rower,Member}', null),
  ('00000000-0000-4000-8000-000000000007', 'Gus Gate',        '{College Rower,Member}', null),
  ('00000000-0000-4000-8000-000000000008', 'Hana Hull',       '{College Rower,Member}', null),
  ('00000000-0000-4000-8000-000000000009', 'Ivo Rudder',      '{Cox,Member}', 'Experienced'),
  ('00000000-0000-4000-8000-000000000010', 'Jo Launch',       '{Coach}', null);

insert into public.outings (id, outing_no, name, type, div, shell, start_at, end_at, status, publish, details) values
  ('00000000-0000-4000-8000-000000000101', 1, 'M1 water session', 'Water Outing', 'M1', 'Eight',
   date_trunc('day', now()) + interval '1 day 7 hours',  date_trunc('day', now()) + interval '1 day 8 hours 30 minutes',
   'Confirmed', true, 'Steady state, rate 20.'),
  ('00000000-0000-4000-8000-000000000102', 2, 'W1 erg', 'Erg Session', 'W1', null,
   date_trunc('day', now()) + interval '2 days 17 hours', date_trunc('day', now()) + interval '2 days 18 hours',
   'Provisional', true, '3 x 2k.'),
  ('00000000-0000-4000-8000-000000000103', 3, 'Cancelled tank', 'Tank Session', 'M2', null,
   date_trunc('day', now()) + interval '3 days 12 hours', date_trunc('day', now()) + interval '3 days 13 hours',
   'Cancelled', false, null);

-- Seat rows already exist (created by trigger); fill some in.
update public.outing_seats s
   set member_id = v.member_id, status = v.status, updated_by = v.member_id
  from (values
    ('Cox',    '00000000-0000-4000-8000-000000000009', 'Available'),
    ('Stroke', '00000000-0000-4000-8000-000000000001', 'Available'),
    ('7 Seat', '00000000-0000-4000-8000-000000000002', 'Maybe Available'),
    ('6 Seat', '00000000-0000-4000-8000-000000000003', 'Available'),
    ('Bow',    '00000000-0000-4000-8000-000000000008', 'Awaiting Approval'),
    ('Coach/Bank Rider', '00000000-0000-4000-8000-000000000010', 'Reserved')
  ) as v (seat, member_id, status)
 where s.outing_id = '00000000-0000-4000-8000-000000000101' and s.seat = v.seat;

insert into public.outing_reports (outing_id, outing_summary, boat_feel, next_focus) values
  ('00000000-0000-4000-8000-000000000101', 'Good rhythm in the second piece.', 'Set improved after the warm-up.', 'Catch timing.');

insert into public.member_unavailability (member_id, monday, wednesday) values
  ('00000000-0000-4000-8000-000000000001', '[{"start": "09:00", "end": "12:00"}]', '[]'),
  ('00000000-0000-4000-8000-000000000002', '[]', '[{"start": "14:00", "end": "16:00"}, {"start": "18:00", "end": "19:30"}]');

insert into public.events (id, title, description, start_at, end_at, all_day) values
  ('00000000-0000-4000-8000-000000000201', 'Club dinner', 'Termly dinner.',
   date_trunc('day', now()) + interval '10 days 19 hours', date_trunc('day', now()) + interval '10 days 22 hours', false);

insert into public.swim_tests (id, title, type, available_slots, start_at, end_at) values
  ('00000000-0000-4000-8000-000000000301', 'Swim test (pool)', 'Swim Test', 6,
   date_trunc('day', now()) + interval '5 days 8 hours', date_trunc('day', now()) + interval '5 days 9 hours');

update public.swim_test_slots
   set member_id = '00000000-0000-4000-8000-000000000005', outcome = 'Test Booked',
       updated_by = '00000000-0000-4000-8000-000000000005'
 where test_id = '00000000-0000-4000-8000-000000000301' and slot = 1;

insert into public.marshal_slots (id, name, slot_no, event, day, shift, role, location, start_at, end_at, publish, clash_crews, person_id, person_status) values
  ('00000000-0000-4000-8000-000000000401', 'Wed S1 Longbridges', 1, 'Other', 'Wed', 'S1', 'Marshal', 'Longbridges',
   date_trunc('day', now()) + interval '7 days 9 hours', date_trunc('day', now()) + interval '7 days 11 hours', true, '{}',
   '00000000-0000-4000-8000-000000000006', 'Reserved'),
  ('00000000-0000-4000-8000-000000000402', 'Wed U1 Umpire', 2, 'Other', 'Wed', 'U1', 'Umpire', null,
   date_trunc('day', now()) + interval '7 days 9 hours', date_trunc('day', now()) + interval '7 days 11 hours', true, '{"Men Div 3"}',
   null, 'Open');
