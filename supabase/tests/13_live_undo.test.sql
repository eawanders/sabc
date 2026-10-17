-- PER-276 (B4): one-tap undo. Only the person who made the change, only while
-- the row is as they left it; the undo is itself a logged write.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into public.members (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Ada'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Ben'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Cora');
insert into public.outings (id, name, type, status, start_at, publish)
  values ('bbbbbbbb-0000-4000-8000-000000000001', 'Erg', 'Erg Session', 'Provisional', now(), true);
insert into public.marshal_slots (id, name, start_at, publish)
  values ('dddddddd-0000-4000-8000-000000000001', 'Shift', now(), true);

create temp table ids (name text primary key, id bigint);

insert into ids select 'claim', (public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Bow',
  'aaaaaaaa-0000-4000-8000-000000000001', 'Awaiting Approval', 'aaaaaaaa-0000-4000-8000-000000000001', 0) ->> 'change_id')::bigint;
update public.notion_outbox set done_at = now() where done_at is null;

-- Someone else can't undo it
select is((public.undo_change((select id from ids where name = 'claim'), 'aaaaaaaa-0000-4000-8000-000000000002')) ->> 'reason',
  'forbidden', 'only the original actor can undo');
select is((public.undo_change(999999, 'aaaaaaaa-0000-4000-8000-000000000001')) ->> 'reason',
  'not_found', 'an unknown change is not_found');

-- The actor can
insert into ids select 'undo', (public.undo_change((select id from ids where name = 'claim'), 'aaaaaaaa-0000-4000-8000-000000000001') ->> 'change_id')::bigint;
select isnt((select id from ids where name = 'undo'), null, 'the actor can undo their own change');
select is((select member_id from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Bow'),
  null, 'undo restored the before image');
select is((select status from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Bow'),
  null, 'undo restored the status too');
select is((select version from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Bow'),
  2, 'undo is a new write (version moves forward)');
select is((select undone_by from public.change_log where id = (select id from ids where name = 'claim')),
  (select id from ids where name = 'undo'), 'the original change points at its undo');
select ok((select before ->> 'member_id' = 'aaaaaaaa-0000-4000-8000-000000000001' and after ->> 'member_id' is null
             from public.change_log where id = (select id from ids where name = 'undo')),
  'the undo is logged with its own before/after');
select is((select payload from public.notion_outbox where done_at is null),
  '{"Bow": {"relation": []}}'::jsonb, 'undo queues the restored relation (a null status is left alone in Notion)');
select is((public.undo_change((select id from ids where name = 'claim'), 'aaaaaaaa-0000-4000-8000-000000000001')) ->> 'reason',
  'conflict', 'a change can be undone once');

-- A change someone has built on can't be undone
insert into ids select 'ada2', (public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke',
  'aaaaaaaa-0000-4000-8000-000000000001', 'Awaiting Approval', 'aaaaaaaa-0000-4000-8000-000000000001', 0) ->> 'change_id')::bigint;
select public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke', 'Available',
  'aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001');
select is((public.undo_change((select id from ids where name = 'ada2'), 'aaaaaaaa-0000-4000-8000-000000000001')) - 'current',
  '{"ok": false, "reason": "conflict", "holder_name": "Ada", "updated_by_name": "Ben"}'::jsonb,
  'undo is a conflict once the row has changed since, naming who changed it');
select is((select member_id::text from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Stroke'),
  'aaaaaaaa-0000-4000-8000-000000000001', 'the refused undo changed nothing');

-- Undo of an undo (redo) works, and restoring a member respects one-seat-per-outing
select ok((public.undo_change((select id from ids where name = 'undo'), 'aaaaaaaa-0000-4000-8000-000000000001')) ->> 'reason' = 'conflict',
  'redo that would put Ada in two seats is a conflict');
select public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke', null, null, 'aaaaaaaa-0000-4000-8000-000000000001', 2);
select is((public.undo_change((select id from ids where name = 'undo'), 'aaaaaaaa-0000-4000-8000-000000000001')) ->> 'ok',
  'true', 'redo (undo of the undo) works once Ada is free');
select is((select member_id::text from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Bow'),
  'aaaaaaaa-0000-4000-8000-000000000001', 'Ada is back in Bow');

-- Swap undo restores both seats
update public.outing_seats set member_id = 'aaaaaaaa-0000-4000-8000-000000000003', status = 'Available'
 where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Sub 1';
insert into ids select 'swap', (public.swap_seats('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'Sub 1',
  'aaaaaaaa-0000-4000-8000-000000000002', 3, 1) ->> 'change_id')::bigint;
select isnt((select id from ids where name = 'swap'), null, 'swap made');
select is((public.undo_change((select id from ids where name = 'swap'), 'aaaaaaaa-0000-4000-8000-000000000002')) ->> 'ok',
  'true', 'swap undone');
select is((select string_agg(seat || '=' || member_id, ',' order by seat) from public.outing_seats
            where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat in ('Bow', 'Sub 1')),
  'Bow=aaaaaaaa-0000-4000-8000-000000000001,Sub 1=aaaaaaaa-0000-4000-8000-000000000003', 'both seats restored');

-- Marshal undo
insert into ids select 'marshal', (public.claim_marshal_slot('dddddddd-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', 0) ->> 'change_id')::bigint;
select is((public.undo_change((select id from ids where name = 'marshal'), 'aaaaaaaa-0000-4000-8000-000000000002')) -> 'row' ->> 'person_status',
  'Open', 'marshal sign-up undone');
select is((select payload from public.notion_outbox where done_at is null and entity = 'marshal_slot'),
  '{"Person": {"relation": []}, "Person Status": {"select": {"name": "Open"}}}'::jsonb, 'marshal undo queued for Notion');

-- Every successful write in this file logged exactly one change
select is((select count(*)::int from public.change_log), 10,
  'claim, undo, claim, status, clear, redo, swap, swap undo, marshal claim + undo = one change_log row each');
select is((select count(*)::int from public.change_log where undone_by is not null), 4, 'four changes were undone');

select * from finish();
rollback;
