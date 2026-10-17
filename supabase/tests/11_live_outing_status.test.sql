-- PER-276 (B4): outing auto-confirm / de-confirm, decided in the database from
-- fresh seat rows. Ported from OutingDrawer's shouldAutoConfirmOuting and
-- syncOutingConfirmation; a Cancelled outing is never moved (audit A6).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into public.members (id, name, cox_experience) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'R1', null),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'R2', null),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'R3', null),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'R4', null),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'R5', null),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'R6', null),
  ('aaaaaaaa-0000-4000-8000-000000000007', 'R7', null),
  ('aaaaaaaa-0000-4000-8000-000000000008', 'R8', null),
  ('aaaaaaaa-0000-4000-8000-000000000009', 'Novice cox', 'Novice'),
  ('aaaaaaaa-0000-4000-8000-000000000010', 'Bank rider', null),
  ('aaaaaaaa-0000-4000-8000-000000000011', 'Old hand cox', 'Experienced');

insert into public.outings (id, name, type, status, start_at, publish) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Water', 'Water Outing', 'Provisional', now(), true),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Erg', 'Erg Session', 'Provisional', now(), true),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'Cancelled water', 'Water Outing', 'Cancelled', now(), true),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'Cancelled erg', 'Erg Session', 'Cancelled', now(), true);

-- Fill a water outing's 9 main seats with the experienced cox, all Available except Bow (Awaiting Approval)
create function pg_temp.fill_water(p_outing text) returns void language sql as $$
  update public.outing_seats s
     set member_id = v.m, status = case when v.seat = 'Bow' then 'Awaiting Approval' else 'Available' end
    from (values ('Cox', 'aaaaaaaa-0000-4000-8000-000000000011'), ('Stroke', 'aaaaaaaa-0000-4000-8000-000000000001'),
                 ('7 Seat', 'aaaaaaaa-0000-4000-8000-000000000002'), ('6 Seat', 'aaaaaaaa-0000-4000-8000-000000000003'),
                 ('5 Seat', 'aaaaaaaa-0000-4000-8000-000000000004'), ('4 Seat', 'aaaaaaaa-0000-4000-8000-000000000005'),
                 ('3 Seat', 'aaaaaaaa-0000-4000-8000-000000000006'), ('2 Seat', 'aaaaaaaa-0000-4000-8000-000000000007'),
                 ('Bow', 'aaaaaaaa-0000-4000-8000-000000000008')) as v (seat, m)
   where s.outing_id = p_outing and s.seat = v.seat;
$$;

create function pg_temp.status_of(p_outing text) returns text language sql as $$
  select status from public.outings where id = p_outing;
$$;

-- ------------------------------------------------------------ Water Outing: confirm
select pg_temp.fill_water('bbbbbbbb-0000-4000-8000-000000000001');

select is((public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'Maybe Available',
          'aaaaaaaa-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000008', 'Green')) ->> 'ok', 'true', 'status change ok');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Provisional',
  'water: not confirmed while one main seat is not Available');

select is((public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', 'Available',
          'aaaaaaaa-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000008', 'Green')) -> 'outing_status',
  '{"from": "Provisional", "to": "Confirmed"}'::jsonb, 'the result reports the outing status change');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Confirmed',
  'water: confirmed when cox + 8 rowers are all Available (experienced cox, green flag)');
select is((select payload -> 'Status' from public.notion_outbox
            where done_at is null and entity_key ->> 'page_id' = 'bbbbbbbb-0000-4000-8000-000000000001'),
  '{"status": {"name": "Confirmed"}}'::jsonb, 'the Notion Status patch is queued with the seat patch');

-- ------------------------------------------------------------ Water Outing: de-confirm
select public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke', 'Not Available',
       'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Green');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Provisional',
  'water: a main seat going not-Available moves Confirmed back to Provisional');
select is((select payload -> 'Status' from public.notion_outbox
            where done_at is null and entity_key ->> 'page_id' = 'bbbbbbbb-0000-4000-8000-000000000001'),
  '{"status": {"name": "Provisional"}}'::jsonb, 'the de-confirm is queued for Notion');

select public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke', 'Available',
       'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Green');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Confirmed', 'water: re-confirmed');

-- Clearing a main seat's member de-confirms (the claim resets the status)
select public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', '2 Seat', null, 'Awaiting Approval',
       'aaaaaaaa-0000-4000-8000-000000000007',
       (select version from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = '2 Seat'),
       'Green');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Provisional',
  'water: removing a rower from a main seat de-confirms');

-- Subs don't count for a water outing
select public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', '2 Seat', 'aaaaaaaa-0000-4000-8000-000000000007', 'Available',
       'aaaaaaaa-0000-4000-8000-000000000007',
       (select version from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = '2 Seat'),
       'Green');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Confirmed', 'water: confirmed again');
select public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Sub 1', 'aaaaaaaa-0000-4000-8000-000000000010', 'Not Available',
       'aaaaaaaa-0000-4000-8000-000000000010', 0, 'Green');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Confirmed',
  'water: an unavailable sub does not de-confirm');
-- (put the bank rider back where the next tests expect: clear Sub 1)
select public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Sub 1', null, null,
       'aaaaaaaa-0000-4000-8000-000000000010', 1, 'Green');

-- ------------------------------------------------------------ Water Outing: bank rider rules
-- Novice cox + Green flag needs an Available bank rider
select public.swap_seats('bbbbbbbb-0000-4000-8000-000000000001', 'Cox', 'Sub 3', 'aaaaaaaa-0000-4000-8000-000000000011',
       (select version from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Cox'), 0, 'Green');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Provisional', 'water: no cox, de-confirmed');
select public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Cox', 'aaaaaaaa-0000-4000-8000-000000000009', 'Available',
       'aaaaaaaa-0000-4000-8000-000000000009',
       (select version from public.outing_seats where outing_id = 'bbbbbbbb-0000-4000-8000-000000000001' and seat = 'Cox'), 'Green');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Provisional',
  'water: novice cox on a green flag without a bank rider stays Provisional');
select public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Coach/Bank Rider', 'aaaaaaaa-0000-4000-8000-000000000010', 'Available',
       'aaaaaaaa-0000-4000-8000-000000000010', 0, 'Green');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Confirmed',
  'water: novice cox on a green flag with an Available bank rider is confirmed');
select is((select payload -> 'Bank Rider Status' from public.notion_outbox
            where done_at is null and entity_key ->> 'page_id' = 'bbbbbbbb-0000-4000-8000-000000000001'),
  '{"status": {"name": "Available"}}'::jsonb, 'the bank rider seat''s status property is "Bank Rider Status"');

-- Same crew without a flag reading: bank rider not required (as the drawer did when the flag fetch failed)
select public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Coach/Bank Rider', 'Not Available',
       'aaaaaaaa-0000-4000-8000-000000000010', 'aaaaaaaa-0000-4000-8000-000000000010', 'Green');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Provisional',
  'water: bank rider going unavailable on a green flag with a novice cox de-confirms');
select public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke', 'Available',
       'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Dark Blue');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Confirmed',
  'water: on a Dark Blue flag a novice cox needs no bank rider (drawer rule)');
-- Amber always needs a bank rider (no change on an Available trigger that fails the rules)
select public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke', 'Not Available',
       'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Amber');
select public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke', 'Available',
       'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Amber');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Provisional',
  'water: amber flag needs an Available bank rider');
select public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000001', 'Stroke', 'Available',
       'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Light Blue');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000001'), 'Provisional',
  'water: light blue flag with a Novice cox needs a bank rider');

-- ------------------------------------------------------------ Non-water outings
select public.claim_seat('bbbbbbbb-0000-4000-8000-000000000002', 'Stroke', 'aaaaaaaa-0000-4000-8000-000000000001', 'Available',
       'aaaaaaaa-0000-4000-8000-000000000001', 0, null);
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000002'), 'Confirmed',
  'erg: confirmed when every assigned (non-sub) seat is Available');
select public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000002', 'Stroke', 'Not Available',
       'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', null);
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000002'), 'Confirmed',
  'erg: never de-confirmed automatically (drawer rule: de-confirm is water-only)');

-- ------------------------------------------------------------ Cancelled is never moved
select pg_temp.fill_water('bbbbbbbb-0000-4000-8000-000000000003');
select public.set_seat_status('bbbbbbbb-0000-4000-8000-000000000003', 'Bow', 'Available',
       'aaaaaaaa-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000008', 'Green');
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000003'), 'Cancelled',
  'a Cancelled water outing is never auto-confirmed');
select ok(not coalesce((select payload ? 'Status' from public.notion_outbox
            where done_at is null and entity_key ->> 'page_id' = 'bbbbbbbb-0000-4000-8000-000000000003'), false),
  'no Status patch is queued for a Cancelled outing');
select public.claim_seat('bbbbbbbb-0000-4000-8000-000000000004', 'Stroke', 'aaaaaaaa-0000-4000-8000-000000000001', 'Available',
       'aaaaaaaa-0000-4000-8000-000000000001', 0, null);
select is(pg_temp.status_of('bbbbbbbb-0000-4000-8000-000000000004'), 'Cancelled',
  'a Cancelled erg is never auto-confirmed');

select * from finish();
rollback;
