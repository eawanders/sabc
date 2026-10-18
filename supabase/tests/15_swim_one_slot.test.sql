-- PER-278: one member, one slot per swim test. claim_test_slot (and undo of a
-- slot change) refuses to put a member in a second slot of the same test, and
-- says which slot they hold, the way claim_seat does with held_seat.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.members (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Ada'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Ben');
insert into public.swim_tests (id, title, type, start_at) values
  ('cccccccc-0000-4000-8000-000000000001', 'Swim', 'Swim Test', now()),
  ('cccccccc-0000-4000-8000-000000000002', 'Swim 2', 'Swim Test', now());

create temp table ids (name text primary key, id bigint);

-- Ada books slot 2
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 2, 'aaaaaaaa-0000-4000-8000-000000000001',
                                  'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'ok', 'true', 'Ada books slot 2');

-- ... and can't also take slot 4 of the same test
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 4, 'aaaaaaaa-0000-4000-8000-000000000001',
                                  'aaaaaaaa-0000-4000-8000-000000000001', 0)) - 'current',
  '{"ok": false, "reason": "conflict", "holder_name": "Ada", "updated_by_name": "Ada", "held_slot": 2}'::jsonb,
  'a second slot in the same test is a conflict saying which slot she holds');
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 4, 'aaaaaaaa-0000-4000-8000-000000000001',
                                  'aaaaaaaa-0000-4000-8000-000000000001', 0)) -> 'current' ->> 'slot',
  '2', 'the conflict carries the slot she holds, as claim_seat carries the seat');
select is((select member_id from public.swim_test_slots where test_id = 'cccccccc-0000-4000-8000-000000000001' and slot = 4),
  null, 'the duplicate was not written');
select is((select count(*)::int from public.change_log), 1, 'a refused claim logs nothing');

-- A coach placing her (actor Ben) is refused the same way
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 5, 'aaaaaaaa-0000-4000-8000-000000000001',
                                  'aaaaaaaa-0000-4000-8000-000000000002', 0)) ->> 'held_slot',
  '2', 'placing someone who is already booked is refused whoever the actor is');

-- Re-claiming the slot she holds is not a duplicate; another test is fine
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 2, 'aaaaaaaa-0000-4000-8000-000000000001',
                                  'aaaaaaaa-0000-4000-8000-000000000001', 1)) ->> 'ok',
  'true', 're-claiming your own slot is allowed');
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000002', 4, 'aaaaaaaa-0000-4000-8000-000000000001',
                                  'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'ok',
  'true', 'one slot per test, not one slot overall');

-- Moving is clear-then-book (as a seat move is a swap, never a second claim)
insert into ids select 'clear', (public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 2, null,
  'aaaaaaaa-0000-4000-8000-000000000001', 2) ->> 'change_id')::bigint;
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000001', 4, 'aaaaaaaa-0000-4000-8000-000000000001',
                                  'aaaaaaaa-0000-4000-8000-000000000001', 0)) ->> 'ok',
  'true', 'once she clears slot 2 she can book slot 4');

-- Undoing the clear would put her back in slot 2 while she is in slot 4
select is((public.undo_change((select id from ids where name = 'clear'), 'aaaaaaaa-0000-4000-8000-000000000001')) ->> 'held_slot',
  '4', 'undo that would double-book her is a conflict naming the slot she holds');
select is((select member_id from public.swim_test_slots where test_id = 'cccccccc-0000-4000-8000-000000000001' and slot = 2),
  null, 'the refused undo changed nothing');

-- Rows that already break the rule (e.g. copied from Notion) don't break claims on other slots
update public.swim_test_slots set member_id = 'aaaaaaaa-0000-4000-8000-000000000002'
 where test_id = 'cccccccc-0000-4000-8000-000000000002' and slot in (1, 2);
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000002', 1, null,
                                  'aaaaaaaa-0000-4000-8000-000000000002', 1)) ->> 'ok',
  'true', 'an existing duplicate can still be cleared');
select is((public.claim_test_slot('cccccccc-0000-4000-8000-000000000002', 3, 'aaaaaaaa-0000-4000-8000-000000000002',
                                  'aaaaaaaa-0000-4000-8000-000000000002', 0)) ->> 'held_slot',
  '2', 'and no new one can be made');

select * from finish();
rollback;
