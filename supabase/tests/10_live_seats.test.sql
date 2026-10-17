-- PER-276 (B4): seat claims. First claim wins, the loser is told who has it;
-- a member can't sit in two seats of one outing; swaps are all-or-nothing;
-- every successful write logs one change and queues one Notion patch per page.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

insert into public.members (id, name, cox_experience) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Ada', null),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Ben', null),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Cora', null);
insert into public.outings (id, name, type, status, start_at, publish)
  values ('bbbbbbbb-0000-4000-8000-000000000001', 'Erg', 'Erg Session', 'Provisional', now(), true);

-- ------------------------------------------------------------ claim_seat: first claim wins
select is(
  (public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'aaaaaaaa-0000-4000-8000-000000000001',
                     'Awaiting Approval', 'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'ok',
  'true', 'first claim at version 0 succeeds');

select is(
  (public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'aaaaaaaa-0000-4000-8000-000000000002',
                     'Awaiting Approval', 'aaaaaaaa-0000-4000-8000-000000000002', 0)) - 'current',
  '{"ok": false, "reason": "conflict", "holder_name": "Ada", "updated_by_name": "Ada"}'::jsonb,
  'second claim at the same version is a conflict naming the holder and who changed it');

select is(
  (public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'aaaaaaaa-0000-4000-8000-000000000002',
                     'Awaiting Approval', 'aaaaaaaa-0000-4000-8000-000000000002', 0)) -> 'current' ->> 'member_id',
  'aaaaaaaa-0000-4000-8000-000000000001', 'the conflict carries the current row');

select is((select member_id::text from public.outing_seats
            where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Bow'),
  'aaaaaaaa-0000-4000-8000-000000000001', 'the loser did not overwrite the seat');

select is((select version from public.outing_seats
            where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Bow'),
  1, 'the winning claim bumped the version once');

select is((select updated_by::text from public.outing_seats
            where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Bow'),
  'aaaaaaaa-0000-4000-8000-000000000001', 'updated_by is the actor');

-- change_log: one row, with before and after images
select is((select count(*)::int from public.change_log), 1, 'one successful claim, one change_log row');
select is((select actor_member_id::text from public.change_log), 'aaaaaaaa-0000-4000-8000-000000000001', 'change_log actor');
select is((select entity_key from public.change_log),
  '{"outing_id": "bbbbbbbb-0000-4000-8000-000000000001", "seat": "Bow"}'::jsonb, 'change_log key is the seat pk');
select ok((select before ->> 'member_id' is null and after ->> 'member_id' = 'aaaaaaaa-0000-4000-8000-000000000001'
             and (before ->> 'version')::int = 0 and (after ->> 'version')::int = 1
             from public.change_log), 'change_log holds before and after row images');

-- outbox: the Notion property patch, as /api/assign-seat sends it
select is((select payload from public.notion_outbox where done_at is null),
  '{"Bow": {"relation": [{"id": "aaaaaaaa-0000-4000-8000-000000000001"}]}, "Bow Status": {"status": {"name": "Awaiting Approval"}}}'::jsonb,
  'outbox carries the seat relation and status');
select is((select entity_key from public.notion_outbox where done_at is null),
  '{"page_id": "bbbbbbbb-0000-4000-8000-000000000001"}'::jsonb, 'outbox row is keyed by the outing page');

-- ------------------------------------------------------------ one member, one seat per outing
select is(
  (public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke', 'aaaaaaaa-0000-4000-8000-000000000001',
                     'Awaiting Approval', 'aaaaaaaa-0000-4000-8000-000000000002', 0)) ->> 'reason',
  'conflict', 'placing a member who already holds another seat is a conflict');
select is(
  (public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke', 'aaaaaaaa-0000-4000-8000-000000000001',
                     'Awaiting Approval', 'aaaaaaaa-0000-4000-8000-000000000002', 0)) ->> 'held_seat',
  'Bow', 'the conflict says where they are');
select is((select member_id from public.outing_seats
            where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Stroke'),
  null, 'the duplicate was not written');

-- Sub seats count too, and the drawer's names ('Sub1') are not accepted by the RPC (the route maps them)
select is(
  (public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Sub 1', 'aaaaaaaa-0000-4000-8000-000000000001',
                     null, 'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'reason',
  'conflict', 'a member in a seat cannot also be a sub');

-- Re-claiming your own seat (e.g. changing status with the claim) is not a duplicate
select is(
  (public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'aaaaaaaa-0000-4000-8000-000000000001',
                     'Available', 'aaaaaaaa-0000-4000-8000-000000000001', 1)) ->> 'ok',
  'true', 'claiming the seat you already hold is allowed');

-- ------------------------------------------------------------ validation
select is((public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', null, null,
                             'aaaaaaaa-0000-4000-8000-000000000099', 2)) ->> 'reason',
  'invalid', 'an actor who is not a member is invalid');
select is((public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'aaaaaaaa-0000-4000-8000-000000000099', null,
                             'aaaaaaaa-0000-4000-8000-000000000001', 2)) ->> 'reason',
  'invalid', 'placing an unknown member is invalid');
select is((public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Sub1', null, null,
                             'aaaaaaaa-0000-4000-8000-000000000001', 2)) ->> 'reason',
  'invalid', 'an unknown seat name is invalid');
select is((public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', null, 'Booked',
                             'aaaaaaaa-0000-4000-8000-000000000001', 2)) ->> 'reason',
  'invalid', 'an unknown status is invalid');
select is((public.claim_seat('bbbbbbbb-0000-4000-8000-000000000009', 'Bow', null, null,
                             'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'reason',
  'not_found', 'an unknown outing is not_found');
select is((public.claim_seat('not-an-id', 'Bow', null, null, 'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'reason',
  'invalid', 'a malformed id is invalid, not an exception');

-- ------------------------------------------------------------ set_seat_status
select is((public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'Not Available',
                                  'aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002')) - 'current',
  '{"ok": false, "reason": "conflict", "holder_name": "Ada", "updated_by_name": "Ada"}'::jsonb,
  'set_seat_status is a conflict when the seat''s member is not who the client saw');
select is((select status from public.outing_seats
            where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Bow'),
  'Available', 'the stale status change was not written');
select is((public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'Maybe Available',
                                  'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001')) ->> 'ok',
  'true', 'set_seat_status succeeds when the member matches');
select is((public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Cox', 'Reserved',
                                  'aaaaaaaa-0000-4000-8000-000000000001', null)) ->> 'ok',
  'true', 'an empty seat can be Reserved (expected member null)');
select is((select payload -> 'Cox Status' from public.notion_outbox where done_at is null),
  '{"status": {"name": "Reserved"}}'::jsonb, 'status patch queued');
select ok(not ((select payload from public.notion_outbox where done_at is null) ? 'Cox'),
  'a status-only change does not touch the relation');

-- ------------------------------------------------------------ swap_seats
-- Fixture: Ben in 7 Seat, Cora in Sub 2
update public.outing_seats set member_id = 'aaaaaaaa-0000-4000-8000-000000000002', status = 'Not Available'
 where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = '7 Seat';
update public.outing_seats set member_id = 'aaaaaaaa-0000-4000-8000-000000000003', status = 'Available'
 where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Sub 2';
delete from public.change_log;
update public.notion_outbox set done_at = now() where done_at is null;

-- stale version on one side: neither seat changes
select is((public.swap_seats('bbbbbbbb-0000-4000-8000-000000000001', '7 Seat', 'Sub 2',
                             'aaaaaaaa-0000-4000-8000-000000000001', 1, 0)) ->> 'reason',
  'conflict', 'a swap with one stale version is a conflict');
select is((select string_agg(seat || '=' || member_id, ',' order by seat) from public.outing_seats
            where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat in ('7 Seat', 'Sub 2')),
  '7 Seat=aaaaaaaa-0000-4000-8000-000000000002,Sub 2=aaaaaaaa-0000-4000-8000-000000000003',
  'neither seat changed (all or nothing)');
select is((select count(*)::int from public.change_log), 0, 'a failed swap logs nothing');
select is((select count(*)::int from public.notion_outbox where done_at is null), 0, 'a failed swap queues nothing');

select is((public.swap_seats('bbbbbbbb-0000-4000-8000-000000000001', '7 Seat', 'Sub 2',
                             'aaaaaaaa-0000-4000-8000-000000000001', 1, 1)) ->> 'ok',
  'true', 'a swap at the current versions succeeds');
select is((select string_agg(seat || '=' || member_id || '/' || status, ',' order by seat) from public.outing_seats
            where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat in ('7 Seat', 'Sub 2')),
  '7 Seat=aaaaaaaa-0000-4000-8000-000000000003/Available,Sub 2=aaaaaaaa-0000-4000-8000-000000000002/Not Available',
  'members and statuses swapped together');
select is((select count(*)::int from public.change_log), 1, 'a swap is one change_log row');
select is((select jsonb_array_length(before) from public.change_log), 2, 'the swap''s before image holds both seats');
select is((select count(*)::int from public.notion_outbox where done_at is null), 1, 'a swap queues one patch for the page');
select is((select payload from public.notion_outbox where done_at is null),
  '{"7 Seat": {"relation": [{"id": "aaaaaaaa-0000-4000-8000-000000000003"}]}, "7 Seat Status": {"status": {"name": "Available"}},
    "Sub 2": {"relation": [{"id": "aaaaaaaa-0000-4000-8000-000000000002"}]}, "Sub 2 Status": {"status": {"name": "Not Available"}}}'::jsonb,
  'swap patch matches /api/swap-seats');

-- A move is a swap into an empty seat
select is((public.swap_seats('bbbbbbbb-0000-4000-8000-000000000001', 'Sub 2', '5 Seat',
                             'aaaaaaaa-0000-4000-8000-000000000002', 2, 0)) ->> 'ok',
  'true', 'moving a member to an empty seat is a swap');
select is((select member_id::text from public.outing_seats
            where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = '5 Seat'),
  'aaaaaaaa-0000-4000-8000-000000000002', 'member moved');

select is((public.swap_seats('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'Bow',
                             'aaaaaaaa-0000-4000-8000-000000000001', 0, 0)) ->> 'reason',
  'invalid', 'swapping a seat with itself is invalid');

-- Coalescing across several RPCs on one outing: still one pending outbox row
select is((select count(*)::int from public.notion_outbox
            where done_at is null and entity_key ->> 'page_id' = 'bbbbbbbb-0000-4000-8000-000000000001'),
  1, 'several writes to one outing coalesce into one pending outbox row');

select * from finish();
rollback;
