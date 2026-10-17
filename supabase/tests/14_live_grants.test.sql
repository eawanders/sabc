-- PER-276 (B4): the write RPCs run only for the server (service role). The
-- browser's anon key can't call them, nor the internal helpers.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

create temp table rpcs (sig text);
insert into rpcs values
  ('public.claim_seat(text, text, text, text, text, integer, text)'),
  ('public.set_seat_status(text, text, text, text, text, text)'),
  ('public.swap_seats(text, text, text, text, integer, integer, text)'),
  ('public.claim_test_slot(text, integer, text, text, integer)'),
  ('public.set_test_outcome(text, integer, text, text, text)'),
  ('public.claim_marshal_slot(text, text, text, integer)'),
  ('public.save_unavailability(text, jsonb, text, integer)'),
  ('public.save_outing_report(text, jsonb, text, integer)'),
  ('public.undo_change(bigint, text, text)');

select ok(not has_function_privilege(r, sig, 'execute'), r || ' cannot execute ' || sig)
  from rpcs, unnest(array['anon', 'authenticated']) as r;
select ok(has_function_privilege('service_role', sig, 'execute'), 'service_role can execute ' || sig) from rpcs;

-- Internal helpers are not callable by anyone but the owner
select ok(not has_function_privilege(r, 'public.recompute_outing_status(text, text, text[])', 'execute'),
  r || ' cannot execute recompute_outing_status')
  from unnest(array['anon', 'authenticated']) as r;
select ok((select prosecdef from pg_proc where oid = 'public.claim_seat(text, text, text, text, text, integer, text)'::regprocedure),
  'the RPCs are security definer');

-- And an actual call as anon fails
set local role anon;
select throws_ok($$ select public.claim_seat('bbbbbbbb-0000-4000-8000-000000000001', 'Bow', null, null,
                                             'aaaaaaaa-0000-4000-8000-000000000001', 0) $$,
  '42501', null, 'anon calling claim_seat is permission denied');
reset role;

select * from finish();
rollback;
