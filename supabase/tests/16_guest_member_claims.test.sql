-- PER-278: adding a guest member claims the normalised name first, so two
-- simultaneous adds of one new name create ONE Notion page. The claim holds
-- across the HTTP request (Notion page create, then members upsert), and a
-- claim whose holder died is taken over after a minute.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into public.members (id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Grace Hopper');

create temp table t (name text primary key, token uuid);

-- First claim wins
insert into t select 'a', (public.claim_guest_name('  Grace   Hopper ') ->> 'token')::uuid;
select isnt((select token from t where name = 'a'), null, 'the first claim of a name wins a token');
select is((select norm_name from public.guest_member_claims), 'grace hopper', 'claims are keyed by the normalised, lower-cased name');

-- A second claim of the same name (any case / spacing) while the first is in flight waits
select is(public.claim_guest_name('GRACE HOPPER'), '{"status": "pending"}'::jsonb, 'a second claim in flight is pending');

-- The winner can't finish with the wrong token; with the right one it records the member
select is(public.finish_guest_claim('Grace Hopper', gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000001'), false,
  'finishing needs the winner''s token');
select is(public.finish_guest_claim('Grace Hopper', (select token from t where name = 'a'), 'aaaaaaaa-0000-4000-8000-000000000001'), true,
  'the winner records the member it created');

-- Now the loser learns who it is
select is(public.claim_guest_name('grace hopper'),
  '{"status": "exists", "member_id": "aaaaaaaa-0000-4000-8000-000000000001", "name": "Grace Hopper"}'::jsonb,
  'after the winner finishes, a claim returns the member');

-- A stale claim (holder crashed: no member after a minute) is taken over
select ok((public.claim_guest_name('Alan Turing') ->> 'status') = 'claimed', 'claim Alan');
select is(public.claim_guest_name('Alan Turing'), '{"status": "pending"}'::jsonb, 'fresh claim blocks');
update public.guest_member_claims set claimed_at = now() - interval '61 seconds' where norm_name = 'alan turing';
insert into t select 'b', (public.claim_guest_name('Alan Turing') ->> 'token')::uuid;
select isnt((select token from t where name = 'b'), null, 'a claim older than a minute is taken over');
select is((select claimed_at from public.guest_member_claims where norm_name = 'alan turing'), now(),
  'the takeover restarts the clock');

-- A finished claim whose member has gone (deleted in Notion) can be claimed again
select public.finish_guest_claim('Alan Turing', (select token from t where name = 'b'), 'aaaaaaaa-0000-4000-8000-000000000009');
select ok((public.claim_guest_name('Alan Turing') ->> 'status') = 'claimed', 'a claim naming a missing member is reclaimable');

-- Release lets a retry go straight away (e.g. after a Notion error)
insert into t select 'c', (public.claim_guest_name('Ada Lovelace') ->> 'token')::uuid;
select is(public.release_guest_claim('Ada Lovelace', gen_random_uuid()), false, 'release needs the token');
select is(public.release_guest_claim('Ada Lovelace', (select token from t where name = 'c')), true, 'the holder can release');
select ok((public.claim_guest_name('Ada Lovelace') ->> 'status') = 'claimed', 'after a release the name is free');

-- Blank names are refused
select is(public.claim_guest_name('   '), '{"status": "invalid"}'::jsonb, 'a blank name is invalid');

-- Server only
select ok(not has_table_privilege('anon', 'public.guest_member_claims', 'select'), 'anon cannot read claims');
select ok(not has_function_privilege('anon', 'public.claim_guest_name(text)', 'execute'), 'anon cannot claim');
select ok(not has_function_privilege('authenticated', 'public.finish_guest_claim(text, uuid, text)', 'execute'),
  'authenticated cannot finish');
select ok(has_function_privilege('service_role', 'public.release_guest_claim(text, uuid)', 'execute'), 'service_role can release');

select * from finish();
rollback;
