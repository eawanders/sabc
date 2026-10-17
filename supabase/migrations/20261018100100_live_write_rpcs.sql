-- PER-276 (Phase B4): atomic claims, conflict feedback, identity and undo.
--
-- Every member write goes through one of these functions, called by a server
-- route with the service role. Each call is one transaction that:
--   1. validates its input (ids, seat/slot names, statuses, the actor);
--   2. checks its precondition against the row the client saw (version, or the
--      member in the seat) and, if that no longer holds, changes nothing and
--      says who has the row now;
--   3. updates the row(s), stamping updated_by with the actor;
--   4. writes ONE change_log row (before/after row images) for undo;
--   5. queues the Notion `properties` patch in notion_outbox (merged per page);
--   6. for seats, re-decides the outing's Confirmed/Provisional status.
--
-- Result (jsonb):
--   {"ok": true,  "change_id": <change_log.id>, "row": <row after>[, "rows": [...]], "outing_status": null | {"from", "to"}}
--   {"ok": false, "reason": "conflict",  "current": <row now>, "holder_name": <who holds it>, "updated_by_name": <who last changed it>[, "held_seat"]}
--   {"ok": false, "reason": "not_found"}
--   {"ok": false, "reason": "invalid",   "message": <safe, fixed text>}
--   {"ok": false, "reason": "forbidden"}                       (undo of someone else's change)
--
-- The actor is a member id ("pick your name once" on the device). There are no
-- auth users: the actor is checked to exist in members, nothing more.

-- ================================================================ helpers
-- Internal: no grants to anon/authenticated/service_role; they run inside the
-- security-definer RPCs below.

create function public.live_is_id(p text) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(p ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false);
$$;

create function public.live_member_exists(p text) returns boolean
language sql stable set search_path = ''
as $$
  select exists (select 1 from public.members where id = p);
$$;

create function public.live_invalid(p_message text) returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object('ok', false, 'reason', 'invalid', 'message', p_message);
$$;

create function public.live_not_found() returns jsonb
language sql immutable set search_path = ''
as $$
  select '{"ok": false, "reason": "not_found"}'::jsonb;
$$;

-- p_current: the row as it is now; p_holder: the member id holding it.
create function public.live_conflict(p_current jsonb, p_holder text) returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'ok', false,
    'reason', 'conflict',
    'current', p_current,
    'holder_name', (select name from public.members where id = p_holder),
    'updated_by_name', (select name from public.members where id = p_current ->> 'updated_by'));
$$;

create function public.live_ok(p_change_id bigint, p_row jsonb, p_outing_status jsonb default null) returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object('ok', true, 'change_id', p_change_id, 'row', p_row, 'outing_status', p_outing_status);
$$;

create function public.live_log(p_actor text, p_entity text, p_key jsonb, p_before jsonb, p_after jsonb) returns bigint
language sql volatile set search_path = ''
as $$
  insert into public.change_log (actor_member_id, entity, entity_key, before, after)
  values (p_actor, p_entity, p_key, p_before, p_after)
  returning id;
$$;

-- Serialises every seat write on one outing, so the one-member-one-seat check
-- and the auto-confirm decision always see the rows the previous write left.
create function public.live_lock_outing(p_outing_id text) returns void
language sql volatile set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('sabc.outing_seats:' || p_outing_id, 0));
$$;

-- ---------------------------------------------------------------- Notion patches
-- Shapes mirror the existing Notion-writing routes (assign-seat, swap-seats,
-- assign-test-slot, update-test-outcome, assign-marshal, update-rower-availability,
-- submit-outing-report). A null status is left out of the patch: the routes
-- never cleared a Notion status property, and the outbox only sends full values.

create function public.live_relation(p_member text) returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object('relation',
    case when p_member is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id', p_member)) end);
$$;

-- Seat names in outing_seats are the Notion relation property names; the
-- status property is "<seat> Status", except the bank rider's.
create function public.live_seat_patch(p_seat text, p_member text, p_status text, p_with_relation boolean default true)
returns jsonb
language sql immutable set search_path = ''
as $$
  select case when p_with_relation then jsonb_build_object(p_seat, public.live_relation(p_member)) else '{}'::jsonb end
      || case when p_status is null then '{}'::jsonb
              else jsonb_build_object(
                     case when p_seat = 'Coach/Bank Rider' then 'Bank Rider Status' else p_seat || ' Status' end,
                     jsonb_build_object('status', jsonb_build_object('name', p_status)))
         end;
$$;

create function public.live_slot_patch(p_slot integer, p_member text, p_outcome text, p_with_relation boolean default true)
returns jsonb
language sql immutable set search_path = ''
as $$
  select case when p_with_relation then jsonb_build_object('Slot ' || p_slot, public.live_relation(p_member)) else '{}'::jsonb end
      || case when p_outcome is null then '{}'::jsonb
              else jsonb_build_object('Slot ' || p_slot || ' Outcome', jsonb_build_object('status', jsonb_build_object('name', p_outcome)))
         end;
$$;

-- "Person Status" is a Notion select (not a status) property.
create function public.live_marshal_patch(p_person text, p_status text) returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'Person', public.live_relation(p_person),
    'Person Status', jsonb_build_object('select', jsonb_build_object('name', p_status)));
$$;

create function public.live_rich_text(p_content text) returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object('rich_text',
    jsonb_build_array(jsonb_build_object('type', 'text', 'text', jsonb_build_object('content', coalesce(p_content, '')))));
$$;

-- What stringifyTimeRanges() writes: JSON.stringify of [{start, end}], "[]" when empty.
create function public.live_ranges_text(p_ranges jsonb) returns text
language sql immutable set search_path = ''
as $$
  select coalesce(
    '[' || string_agg(format('{"start":%s,"end":%s}', to_json(e ->> 'start'), to_json(e ->> 'end')), ',' order by i) || ']',
    '[]')
  from jsonb_array_elements(p_ranges) with ordinality as t (e, i);
$$;

create function public.live_unavailability_patch(p_row jsonb) returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_object_agg(
           'Unavailable ' || initcap(d),
           jsonb_build_object('type', 'rich_text') || public.live_rich_text(public.live_ranges_text(p_row -> d)))
    from unnest(array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) as d;
$$;

create function public.live_report_property(p_field text) returns text
language sql immutable set search_path = ''
as $$
  select case p_field
           when 'outing_summary' then 'Outing Summary'
           when 'boat_feel' then 'Boat Feel'
           when 'outing_successes' then 'Outing Successes'
           when 'next_focus' then 'Next Focus'
           when 'coach_feedback' then 'Coach Feedback'
         end;
$$;

-- Only the listed fields are patched (submit-outing-report only sent fields it was given).
create function public.live_report_patch(p_row jsonb, p_fields text[]) returns jsonb
language sql immutable set search_path = ''
as $$
  select coalesce(jsonb_object_agg(public.live_report_property(f), public.live_rich_text(p_row ->> f)), '{}'::jsonb)
    from unnest(p_fields) as f;
$$;

-- ================================================================ recompute_outing_status
-- Ported from OutingDrawer's shouldAutoConfirmOuting + syncOutingConfirmation,
-- but decided here from the rows as they are after this write (not from the
-- client's possibly stale copy).
--
-- p_flag_status: the river flag's status_text (e.g. 'Green', 'Light Blue'),
--   which the route fetches from OURCS (cached ~60 s) because SQL can't. Null
--   when unknown. Unknown means no bank-rider requirement when judging whether
--   the crew is complete (so it never de-confirms anything on its own), but a
--   water outing is not auto-confirmed while the flag is unknown (owner, 17 Oct).
-- p_triggers: the seat statuses this write set (null = cleared). The drawer
--   ran its check after a seat status change with that new status; a swap ran
--   it with both 'Available' and 'Not Available'.
--
-- Rules:
--   C0  A Cancelled outing is never changed (audit A6). Neither is a missing one.
--   W1  Water Outing "ready": Cox, Stroke, 7..2 Seat and Bow each have a member
--       whose status is Available (subs and the bank rider don't count).
--   W2  ...and, if a bank rider is required, Coach/Bank Rider has a member who
--       is Available. Required when the flag (lower-cased, first space -> '-') is
--         'green' and the cox's experience is 'Novice' or 'Novice (less than 1 term)';
--         'light-blue' and the cox's experience is 'Novice';
--         'amber'.
--   N1  Any other type "ready": at least one non-sub seat (bank rider included)
--       has a member, and every non-sub seat with a member is Available.
--   R1  Confirm: a trigger is 'Available', the outing is ready, and it is not
--       already Confirmed  ->  Confirmed. A Water Outing additionally needs a
--       known flag that is not 'red' or 'black' (no crews out); otherwise it
--       stays as it is and a coach decides.
--   R2  De-confirm (Water Outing only): a trigger is not 'Available', the
--       outing is not ready, and it is Confirmed  ->  Provisional.
--   Anything else leaves the status alone (an erg is never de-confirmed; a
--   manually Confirmed but incomplete water outing stays Confirmed until a
--   seat goes not-Available).
-- When the status changes, the Notion "Status" patch is queued on the outing page.
create function public.recompute_outing_status(p_outing_id text, p_flag_status text, p_triggers text[])
returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
  v_type   text;
  v_status text;
  v_ready  boolean;
  v_flag   text := regexp_replace(lower(coalesce(p_flag_status, '')), ' ', '-');
  v_cox    text;
  v_new    text;
begin
  select type, status into v_type, v_status from public.outings where id = p_outing_id for update;
  if not found or v_status = 'Cancelled' then
    return null;                                                                   -- C0
  end if;

  if v_type = 'Water Outing' then
    select count(*) = 9 into v_ready                                               -- W1
      from public.outing_seats
     where outing_id = p_outing_id
       and seat in ('Cox', 'Stroke', '7 Seat', '6 Seat', '5 Seat', '4 Seat', '3 Seat', '2 Seat', 'Bow')
       and member_id is not null and status = 'Available';

    if v_ready then                                                                -- W2
      select m.cox_experience into v_cox
        from public.outing_seats s join public.members m on m.id = s.member_id
       where s.outing_id = p_outing_id and s.seat = 'Cox';
      if (v_flag = 'green' and v_cox in ('Novice', 'Novice (less than 1 term)'))
         or (v_flag = 'light-blue' and v_cox = 'Novice')
         or v_flag = 'amber' then
        select exists (select 1 from public.outing_seats
                        where outing_id = p_outing_id and seat = 'Coach/Bank Rider'
                          and member_id is not null and status = 'Available')
          into v_ready;
      end if;
    end if;
  else
    select count(*) > 0 and bool_and(status is not distinct from 'Available') into v_ready   -- N1
      from public.outing_seats
     where outing_id = p_outing_id and seat not like 'Sub %' and member_id is not null;
  end if;
  v_ready := coalesce(v_ready, false);

  if v_ready and 'Available' = any (p_triggers) and v_status is distinct from 'Confirmed'
     and (v_type is distinct from 'Water Outing' or v_flag not in ('', 'red', 'black')) then
    v_new := 'Confirmed';                                                          -- R1
  elsif not v_ready and v_type = 'Water Outing' and v_status = 'Confirmed'
        and exists (select 1 from unnest(p_triggers) as t where t is distinct from 'Available') then
    v_new := 'Provisional';                                                        -- R2
  else
    return null;
  end if;

  update public.outings set status = v_new where id = p_outing_id;
  perform public.enqueue_notion_outbox('outing', jsonb_build_object('page_id', p_outing_id),
                                       jsonb_build_object('Status', jsonb_build_object('status', jsonb_build_object('name', v_new))));
  return jsonb_build_object('from', v_status, 'to', v_new);
end;
$$;

-- ================================================================ seats

create function public.live_seat_names() returns text[]
language sql immutable set search_path = ''
as $$
  select array['Cox', 'Stroke', '7 Seat', '6 Seat', '5 Seat', '4 Seat', '3 Seat', '2 Seat', 'Bow',
               'Sub 1', 'Sub 2', 'Sub 3', 'Sub 4', 'Coach/Bank Rider'];
$$;

create function public.live_seat_statuses() returns text[]
language sql immutable set search_path = ''
as $$
  select array['Available', 'Maybe Available', 'Not Available', 'Awaiting Approval', 'Reserved'];
$$;

-- Put a member in a seat (or clear it), optionally setting its status in the
-- same write. First claim wins: the write happens only if the seat is still at
-- p_expected_version. A member can hold one seat per outing; moving them is a
-- swap_seats into the empty seat. p_status null leaves the status as it is.
create function public.claim_seat(
  p_outing_id text, p_seat text, p_member_id text, p_status text,
  p_actor text, p_expected_version integer, p_flag_status text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_before public.outing_seats;
  v_after  public.outing_seats;
  v_other  public.outing_seats;
  v_change bigint;
begin
  if not public.live_is_id(p_outing_id) or not public.live_is_id(p_actor)
     or (p_member_id is not null and not public.live_is_id(p_member_id)) then
    return public.live_invalid('malformed id');
  end if;
  if p_seat is null or not (p_seat = any (public.live_seat_names())) then
    return public.live_invalid('unknown seat');
  end if;
  if p_status is not null and not (p_status = any (public.live_seat_statuses())) then
    return public.live_invalid('unknown status');
  end if;
  if p_expected_version is null then
    return public.live_invalid('expected_version is required');
  end if;
  if not public.live_member_exists(p_actor) then
    return public.live_invalid('unknown actor');
  end if;
  if p_member_id is not null and not public.live_member_exists(p_member_id) then
    return public.live_invalid('unknown member');
  end if;

  perform public.live_lock_outing(p_outing_id);

  select * into v_before from public.outing_seats where outing_id = p_outing_id and seat = p_seat for update;
  if not found then
    return public.live_not_found();
  end if;
  if v_before.version <> p_expected_version then
    return public.live_conflict(to_jsonb(v_before), v_before.member_id);
  end if;

  if p_member_id is not null then
    select * into v_other from public.outing_seats
     where outing_id = p_outing_id and member_id = p_member_id and seat <> p_seat
     limit 1;
    if found then
      return public.live_conflict(to_jsonb(v_other), v_other.member_id) || jsonb_build_object('held_seat', v_other.seat);
    end if;
  end if;

  update public.outing_seats
     set member_id = p_member_id, status = coalesce(p_status, status), updated_by = p_actor
   where outing_id = p_outing_id and seat = p_seat
  returning * into v_after;

  v_change := public.live_log(p_actor, 'outing_seats',
                              jsonb_build_object('outing_id', p_outing_id, 'seat', p_seat),
                              to_jsonb(v_before), to_jsonb(v_after));
  perform public.enqueue_notion_outbox('outing', jsonb_build_object('page_id', p_outing_id),
                                       public.live_seat_patch(p_seat, v_after.member_id, p_status));

  return public.live_ok(v_change, to_jsonb(v_after),
                        public.recompute_outing_status(p_outing_id, p_flag_status, array[v_after.status]));
end;
$$;

-- Change a seat's status. Conflict if the seat's member is no longer the one
-- the client saw (p_expected_member_id; null = the seat was empty).
create function public.set_seat_status(
  p_outing_id text, p_seat text, p_status text, p_actor text, p_expected_member_id text, p_flag_status text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_before public.outing_seats;
  v_after  public.outing_seats;
  v_change bigint;
begin
  if not public.live_is_id(p_outing_id) or not public.live_is_id(p_actor)
     or (p_expected_member_id is not null and not public.live_is_id(p_expected_member_id)) then
    return public.live_invalid('malformed id');
  end if;
  if p_seat is null or not (p_seat = any (public.live_seat_names())) then
    return public.live_invalid('unknown seat');
  end if;
  if p_status is null or not (p_status = any (public.live_seat_statuses())) then
    return public.live_invalid('unknown status');
  end if;
  if not public.live_member_exists(p_actor) then
    return public.live_invalid('unknown actor');
  end if;

  perform public.live_lock_outing(p_outing_id);

  select * into v_before from public.outing_seats where outing_id = p_outing_id and seat = p_seat for update;
  if not found then
    return public.live_not_found();
  end if;
  if v_before.member_id is distinct from p_expected_member_id then
    return public.live_conflict(to_jsonb(v_before), v_before.member_id);
  end if;

  update public.outing_seats set status = p_status, updated_by = p_actor
   where outing_id = p_outing_id and seat = p_seat
  returning * into v_after;

  v_change := public.live_log(p_actor, 'outing_seats',
                              jsonb_build_object('outing_id', p_outing_id, 'seat', p_seat),
                              to_jsonb(v_before), to_jsonb(v_after));
  perform public.enqueue_notion_outbox('outing', jsonb_build_object('page_id', p_outing_id),
                                       public.live_seat_patch(p_seat, null, p_status, false));

  return public.live_ok(v_change, to_jsonb(v_after),
                        public.recompute_outing_status(p_outing_id, p_flag_status, array[p_status]));
end;
$$;

-- Swap two seats' members and statuses, both or neither. Swapping with an
-- empty seat moves the member. Logged as ONE change (entity_key.seats, and
-- before/after are two-element arrays) so one undo reverses both seats.
create function public.swap_seats(
  p_outing_id text, p_seat_a text, p_seat_b text, p_actor text,
  p_expected_version_a integer, p_expected_version_b integer, p_flag_status text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_a  public.outing_seats;
  v_b  public.outing_seats;
  v_a2 public.outing_seats;
  v_b2 public.outing_seats;
  v_change bigint;
begin
  if not public.live_is_id(p_outing_id) or not public.live_is_id(p_actor) then
    return public.live_invalid('malformed id');
  end if;
  if p_seat_a is null or p_seat_b is null
     or not (p_seat_a = any (public.live_seat_names())) or not (p_seat_b = any (public.live_seat_names())) then
    return public.live_invalid('unknown seat');
  end if;
  if p_seat_a = p_seat_b then
    return public.live_invalid('a seat cannot be swapped with itself');
  end if;
  if p_expected_version_a is null or p_expected_version_b is null then
    return public.live_invalid('expected versions are required');
  end if;
  if not public.live_member_exists(p_actor) then
    return public.live_invalid('unknown actor');
  end if;

  perform public.live_lock_outing(p_outing_id);

  select * into v_a from public.outing_seats where outing_id = p_outing_id and seat = p_seat_a for update;
  select * into v_b from public.outing_seats where outing_id = p_outing_id and seat = p_seat_b for update;
  if v_a.seat is null or v_b.seat is null then
    return public.live_not_found();
  end if;
  if v_a.version <> p_expected_version_a then
    return public.live_conflict(to_jsonb(v_a), v_a.member_id);
  end if;
  if v_b.version <> p_expected_version_b then
    return public.live_conflict(to_jsonb(v_b), v_b.member_id);
  end if;

  update public.outing_seats set member_id = v_b.member_id, status = v_b.status, updated_by = p_actor
   where outing_id = p_outing_id and seat = p_seat_a returning * into v_a2;
  update public.outing_seats set member_id = v_a.member_id, status = v_a.status, updated_by = p_actor
   where outing_id = p_outing_id and seat = p_seat_b returning * into v_b2;

  v_change := public.live_log(p_actor, 'outing_seats',
                              jsonb_build_object('outing_id', p_outing_id, 'seats', jsonb_build_array(p_seat_a, p_seat_b)),
                              jsonb_build_array(to_jsonb(v_a), to_jsonb(v_b)),
                              jsonb_build_array(to_jsonb(v_a2), to_jsonb(v_b2)));
  perform public.enqueue_notion_outbox('outing', jsonb_build_object('page_id', p_outing_id),
                                       public.live_seat_patch(p_seat_a, v_a2.member_id, v_a2.status)
                                       || public.live_seat_patch(p_seat_b, v_b2.member_id, v_b2.status));

  return public.live_ok(v_change, to_jsonb(v_a2),
                        public.recompute_outing_status(p_outing_id, p_flag_status, array['Available', 'Not Available']))
         || jsonb_build_object('rows', jsonb_build_array(to_jsonb(v_a2), to_jsonb(v_b2)));
end;
$$;

-- ================================================================ swim-test slots

-- Book a slot (or clear it). As /api/assign-test-slot: booking sets the
-- outcome to 'Test Booked' unless it is already Passed / Failed / Test Booked;
-- clearing sets 'No Show'.
create function public.claim_test_slot(
  p_test_id text, p_slot integer, p_member_id text, p_actor text, p_expected_version integer)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_before public.swim_test_slots;
  v_after  public.swim_test_slots;
  v_change bigint;
begin
  if not public.live_is_id(p_test_id) or not public.live_is_id(p_actor)
     or (p_member_id is not null and not public.live_is_id(p_member_id)) then
    return public.live_invalid('malformed id');
  end if;
  if p_slot is null or p_slot not between 1 and 6 then
    return public.live_invalid('slot must be 1 to 6');
  end if;
  if p_expected_version is null then
    return public.live_invalid('expected_version is required');
  end if;
  if not public.live_member_exists(p_actor) then
    return public.live_invalid('unknown actor');
  end if;
  if p_member_id is not null and not public.live_member_exists(p_member_id) then
    return public.live_invalid('unknown member');
  end if;

  select * into v_before from public.swim_test_slots where test_id = p_test_id and slot = p_slot for update;
  if not found then
    return public.live_not_found();
  end if;
  if v_before.version <> p_expected_version then
    return public.live_conflict(to_jsonb(v_before), v_before.member_id);
  end if;

  update public.swim_test_slots
     set member_id = p_member_id,
         outcome = case when p_member_id is null then 'No Show'
                        when outcome in ('Passed', 'Failed', 'Test Booked') then outcome
                        else 'Test Booked' end,
         updated_by = p_actor
   where test_id = p_test_id and slot = p_slot
  returning * into v_after;

  v_change := public.live_log(p_actor, 'swim_test_slots', jsonb_build_object('test_id', p_test_id, 'slot', p_slot),
                              to_jsonb(v_before), to_jsonb(v_after));
  perform public.enqueue_notion_outbox('swim_test', jsonb_build_object('page_id', p_test_id),
                                       public.live_slot_patch(p_slot, v_after.member_id, v_after.outcome));
  return public.live_ok(v_change, to_jsonb(v_after));
end;
$$;

-- Set a slot's outcome. Conflict if the slot's member is no longer the one the
-- client saw.
create function public.set_test_outcome(
  p_test_id text, p_slot integer, p_outcome text, p_actor text, p_expected_member_id text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_before public.swim_test_slots;
  v_after  public.swim_test_slots;
  v_change bigint;
begin
  if not public.live_is_id(p_test_id) or not public.live_is_id(p_actor)
     or (p_expected_member_id is not null and not public.live_is_id(p_expected_member_id)) then
    return public.live_invalid('malformed id');
  end if;
  if p_slot is null or p_slot not between 1 and 6 then
    return public.live_invalid('slot must be 1 to 6');
  end if;
  if p_outcome is null or p_outcome not in ('No Show', 'Test Booked', 'Failed', 'Passed') then
    return public.live_invalid('unknown outcome');
  end if;
  if not public.live_member_exists(p_actor) then
    return public.live_invalid('unknown actor');
  end if;

  select * into v_before from public.swim_test_slots where test_id = p_test_id and slot = p_slot for update;
  if not found then
    return public.live_not_found();
  end if;
  if v_before.member_id is distinct from p_expected_member_id then
    return public.live_conflict(to_jsonb(v_before), v_before.member_id);
  end if;

  update public.swim_test_slots set outcome = p_outcome, updated_by = p_actor
   where test_id = p_test_id and slot = p_slot
  returning * into v_after;

  v_change := public.live_log(p_actor, 'swim_test_slots', jsonb_build_object('test_id', p_test_id, 'slot', p_slot),
                              to_jsonb(v_before), to_jsonb(v_after));
  perform public.enqueue_notion_outbox('swim_test', jsonb_build_object('page_id', p_test_id),
                                       public.live_slot_patch(p_slot, null, p_outcome, false));
  return public.live_ok(v_change, to_jsonb(v_after));
end;
$$;

-- ================================================================ marshal slots

-- Sign up for (or clear) a marshal slot. As /api/assign-marshal: signing up
-- is Confirmed straight away, clearing reopens it (Open).
create function public.claim_marshal_slot(
  p_slot_id text, p_member_id text, p_actor text, p_expected_version integer)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_before public.marshal_slots;
  v_after  public.marshal_slots;
  v_change bigint;
begin
  if not public.live_is_id(p_slot_id) or not public.live_is_id(p_actor)
     or (p_member_id is not null and not public.live_is_id(p_member_id)) then
    return public.live_invalid('malformed id');
  end if;
  if p_expected_version is null then
    return public.live_invalid('expected_version is required');
  end if;
  if not public.live_member_exists(p_actor) then
    return public.live_invalid('unknown actor');
  end if;
  if p_member_id is not null and not public.live_member_exists(p_member_id) then
    return public.live_invalid('unknown member');
  end if;

  select * into v_before from public.marshal_slots where id = p_slot_id for update;
  if not found then
    return public.live_not_found();
  end if;
  if v_before.version <> p_expected_version then
    return public.live_conflict(to_jsonb(v_before), v_before.person_id);
  end if;

  update public.marshal_slots
     set person_id = p_member_id,
         person_status = case when p_member_id is null then 'Open' else 'Confirmed' end,
         updated_by = p_actor
   where id = p_slot_id
  returning * into v_after;

  v_change := public.live_log(p_actor, 'marshal_slots', jsonb_build_object('id', p_slot_id),
                              to_jsonb(v_before), to_jsonb(v_after));
  perform public.enqueue_notion_outbox('marshal_slot', jsonb_build_object('page_id', p_slot_id),
                                       public.live_marshal_patch(v_after.person_id, v_after.person_status));
  return public.live_ok(v_change, to_jsonb(v_after));
end;
$$;

-- ================================================================ weekly unavailability

-- Save a member's weekly unavailability. p_days: {"monday": [{"start": "HH:MM",
-- "end": "HH:MM"}], ...}; days left out are unchanged. A member with no row yet
-- is at version 0 (the row is created on the first save). Range rules (max 3
-- a day, no overlaps) are checked by the route (validateWeeklyAvailability).
create function public.save_unavailability(p_member_id text, p_days jsonb, p_actor text, p_expected_version integer)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_before public.member_unavailability;
  v_after  public.member_unavailability;
  v_change bigint;
begin
  if not public.live_is_id(p_member_id) or not public.live_is_id(p_actor) then
    return public.live_invalid('malformed id');
  end if;
  if p_days is null or jsonb_typeof(p_days) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_days) as k
                 where k not in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')) then
    return public.live_invalid('days must be an object keyed by weekday');
  end if;
  if exists (select 1 from jsonb_each(p_days) as d (k, v)
              where jsonb_typeof(v) <> 'array'
                 or exists (select 1 from jsonb_array_elements(v) as e
                             where jsonb_typeof(e) <> 'object'
                                or coalesce(e ->> 'start', '') !~ '^\d{2}:\d{2}$'
                                or coalesce(e ->> 'end', '') !~ '^\d{2}:\d{2}$')) then
    return public.live_invalid('each day must be a list of {start, end} times');
  end if;
  if p_expected_version is null then
    return public.live_invalid('expected_version is required');
  end if;
  if not public.live_member_exists(p_actor) then
    return public.live_invalid('unknown actor');
  end if;
  if not public.live_member_exists(p_member_id) then
    return public.live_not_found();
  end if;

  if p_expected_version = 0 then
    insert into public.member_unavailability (member_id) values (p_member_id) on conflict do nothing;
  end if;

  select * into v_before from public.member_unavailability where member_id = p_member_id for update;
  if not found or v_before.version <> p_expected_version then
    return public.live_conflict(to_jsonb(v_before), null);
  end if;

  update public.member_unavailability
     set monday    = coalesce(p_days -> 'monday', monday),
         tuesday   = coalesce(p_days -> 'tuesday', tuesday),
         wednesday = coalesce(p_days -> 'wednesday', wednesday),
         thursday  = coalesce(p_days -> 'thursday', thursday),
         friday    = coalesce(p_days -> 'friday', friday),
         saturday  = coalesce(p_days -> 'saturday', saturday),
         sunday    = coalesce(p_days -> 'sunday', sunday),
         updated_by = p_actor
   where member_id = p_member_id
  returning * into v_after;

  v_change := public.live_log(p_actor, 'member_unavailability', jsonb_build_object('member_id', p_member_id),
                              to_jsonb(v_before), to_jsonb(v_after));
  perform public.enqueue_notion_outbox('member', jsonb_build_object('page_id', p_member_id),
                                       public.live_unavailability_patch(to_jsonb(v_after)));
  return public.live_ok(v_change, to_jsonb(v_after));
end;
$$;

-- ================================================================ outing reports

-- Save an outing report. p_fields: any of outing_summary, boat_feel,
-- outing_successes, next_focus, coach_feedback (string or null); fields left
-- out are unchanged. An outing with no report yet is at version 0.
create function public.save_outing_report(p_outing_id text, p_fields jsonb, p_actor text, p_expected_version integer)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_before public.outing_reports;
  v_after  public.outing_reports;
  v_keys   text[];
  v_change bigint;
begin
  if not public.live_is_id(p_outing_id) or not public.live_is_id(p_actor) then
    return public.live_invalid('malformed id');
  end if;
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    return public.live_invalid('fields must be an object');
  end if;
  select coalesce(array_agg(k), '{}') into v_keys from jsonb_object_keys(p_fields) as k;
  if exists (select 1 from unnest(v_keys) as k where public.live_report_property(k) is null)
     or exists (select 1 from jsonb_each(p_fields) as f (k, v) where jsonb_typeof(v) not in ('string', 'null')) then
    return public.live_invalid('unknown report field');
  end if;
  if p_expected_version is null then
    return public.live_invalid('expected_version is required');
  end if;
  if not public.live_member_exists(p_actor) then
    return public.live_invalid('unknown actor');
  end if;
  if not exists (select 1 from public.outings where id = p_outing_id) then
    return public.live_not_found();
  end if;

  if p_expected_version = 0 then
    insert into public.outing_reports (outing_id) values (p_outing_id) on conflict do nothing;
  end if;

  select * into v_before from public.outing_reports where outing_id = p_outing_id for update;
  if not found or v_before.version <> p_expected_version then
    return public.live_conflict(to_jsonb(v_before), null);
  end if;

  update public.outing_reports
     set outing_summary   = case when p_fields ? 'outing_summary' then p_fields ->> 'outing_summary' else outing_summary end,
         boat_feel        = case when p_fields ? 'boat_feel' then p_fields ->> 'boat_feel' else boat_feel end,
         outing_successes = case when p_fields ? 'outing_successes' then p_fields ->> 'outing_successes' else outing_successes end,
         next_focus       = case when p_fields ? 'next_focus' then p_fields ->> 'next_focus' else next_focus end,
         coach_feedback   = case when p_fields ? 'coach_feedback' then p_fields ->> 'coach_feedback' else coach_feedback end,
         updated_by = p_actor
   where outing_id = p_outing_id
  returning * into v_after;

  v_change := public.live_log(p_actor, 'outing_reports', jsonb_build_object('outing_id', p_outing_id),
                              to_jsonb(v_before), to_jsonb(v_after));
  if cardinality(v_keys) > 0 then
    perform public.enqueue_notion_outbox('outing', jsonb_build_object('page_id', p_outing_id),
                                         public.live_report_patch(to_jsonb(v_after), v_keys));
  end if;
  return public.live_ok(v_change, to_jsonb(v_after));
end;
$$;

-- ================================================================ undo

-- Undo a change: only by the member who made it, only once, and only while
-- every row it touched is still at the version it left (nobody has changed it
-- since). Writes `before` back as a NEW logged change (so an undo can itself be
-- undone) and points the original's undone_by at it. Seat undos keep the
-- one-member-one-seat rule and re-run the outing auto-confirm.
create function public.undo_change(p_change_id bigint, p_actor text, p_flag_status text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_log     public.change_log;
  v_befores jsonb;
  v_afters  jsonb;
  v_now     jsonb := '[]';
  v_new     jsonb := '[]';
  v_key     jsonb;
  v_cur     jsonb;
  v_b       jsonb;
  v_row     jsonb;
  v_patch   jsonb := '{}';
  v_page    text;
  v_notion  text;
  v_seats   text[];
  v_dup     public.outing_seats;
  v_outing  jsonb;
  v_change  bigint;
  i         integer;
begin
  if p_change_id is null or not public.live_is_id(p_actor) then
    return public.live_invalid('malformed id');
  end if;
  if not public.live_member_exists(p_actor) then
    return public.live_invalid('unknown actor');
  end if;

  select * into v_log from public.change_log where id = p_change_id;
  if not found then
    return public.live_not_found();
  end if;
  if v_log.actor_member_id is distinct from p_actor then
    return '{"ok": false, "reason": "forbidden"}'::jsonb;
  end if;
  if v_log.entity = 'outing_seats' then
    perform public.live_lock_outing(v_log.entity_key ->> 'outing_id');
  end if;

  -- Lock the log row too, so two taps on Undo can't both apply it
  select * into v_log from public.change_log where id = p_change_id for update;
  if v_log.undone_by is not null then
    return public.live_conflict(null, null) || '{"message": "already undone"}'::jsonb;
  end if;

  v_befores := case when jsonb_typeof(v_log.before) = 'array' then v_log.before else jsonb_build_array(v_log.before) end;
  v_afters  := case when jsonb_typeof(v_log.after)  = 'array' then v_log.after  else jsonb_build_array(v_log.after)  end;
  if v_log.before is null or v_log.after is null or jsonb_array_length(v_befores) <> jsonb_array_length(v_afters) then
    return public.live_invalid('this change cannot be undone');
  end if;

  -- 1. Every row must be as the change left it
  for i in 0 .. jsonb_array_length(v_afters) - 1 loop
    v_key := v_afters -> i;
    v_cur := case v_log.entity
      when 'outing_seats' then (select to_jsonb(r) from public.outing_seats r
                                 where outing_id = v_key ->> 'outing_id' and seat = v_key ->> 'seat' for update)
      when 'swim_test_slots' then (select to_jsonb(r) from public.swim_test_slots r
                                    where test_id = v_key ->> 'test_id' and slot = (v_key ->> 'slot')::smallint for update)
      when 'marshal_slots' then (select to_jsonb(r) from public.marshal_slots r where id = v_key ->> 'id' for update)
      when 'member_unavailability' then (select to_jsonb(r) from public.member_unavailability r
                                          where member_id = v_key ->> 'member_id' for update)
      when 'outing_reports' then (select to_jsonb(r) from public.outing_reports r
                                   where outing_id = v_key ->> 'outing_id' for update)
    end;
    if v_cur is null then
      return public.live_not_found();
    end if;
    if (v_cur ->> 'version')::int <> (v_key ->> 'version')::int then
      return public.live_conflict(v_cur, coalesce(v_cur ->> 'member_id', v_cur ->> 'person_id'));
    end if;
    v_now := v_now || jsonb_build_array(v_cur);
  end loop;

  -- 2. Seats: restoring a member must not put them in a second seat
  if v_log.entity = 'outing_seats' then
    select array_agg(e ->> 'seat') into v_seats from jsonb_array_elements(v_afters) as e;
    for i in 0 .. jsonb_array_length(v_befores) - 1 loop
      v_b := v_befores -> i;
      if v_b ->> 'member_id' is not null then
        select * into v_dup from public.outing_seats
         where outing_id = v_b ->> 'outing_id' and member_id = v_b ->> 'member_id' and not (seat = any (v_seats))
         limit 1;
        if found then
          return public.live_conflict(to_jsonb(v_dup), v_dup.member_id) || jsonb_build_object('held_seat', v_dup.seat);
        end if;
      end if;
    end loop;
  end if;

  -- 3. Write the before images back (app-owned columns only), building the Notion patch
  for i in 0 .. jsonb_array_length(v_befores) - 1 loop
    v_b := v_befores -> i;
    case v_log.entity
      when 'outing_seats' then
        update public.outing_seats
           set member_id = v_b ->> 'member_id', status = v_b ->> 'status', updated_by = p_actor
         where outing_id = v_b ->> 'outing_id' and seat = v_b ->> 'seat'
        returning to_jsonb(outing_seats.*) into v_row;
        v_notion := 'outing'; v_page := v_b ->> 'outing_id';
        v_patch := v_patch || public.live_seat_patch(v_b ->> 'seat', v_b ->> 'member_id', v_b ->> 'status');
      when 'swim_test_slots' then
        update public.swim_test_slots
           set member_id = v_b ->> 'member_id', outcome = v_b ->> 'outcome', updated_by = p_actor
         where test_id = v_b ->> 'test_id' and slot = (v_b ->> 'slot')::smallint
        returning to_jsonb(swim_test_slots.*) into v_row;
        v_notion := 'swim_test'; v_page := v_b ->> 'test_id';
        v_patch := v_patch || public.live_slot_patch((v_b ->> 'slot')::int, v_b ->> 'member_id', v_b ->> 'outcome');
      when 'marshal_slots' then
        update public.marshal_slots
           set person_id = v_b ->> 'person_id', person_status = v_b ->> 'person_status', updated_by = p_actor
         where id = v_b ->> 'id'
        returning to_jsonb(marshal_slots.*) into v_row;
        v_notion := 'marshal_slot'; v_page := v_b ->> 'id';
        v_patch := v_patch || public.live_marshal_patch(v_b ->> 'person_id', v_b ->> 'person_status');
      when 'member_unavailability' then
        update public.member_unavailability
           set monday = v_b -> 'monday', tuesday = v_b -> 'tuesday', wednesday = v_b -> 'wednesday',
               thursday = v_b -> 'thursday', friday = v_b -> 'friday', saturday = v_b -> 'saturday',
               sunday = v_b -> 'sunday', updated_by = p_actor
         where member_id = v_b ->> 'member_id'
        returning to_jsonb(member_unavailability.*) into v_row;
        v_notion := 'member'; v_page := v_b ->> 'member_id';
        v_patch := v_patch || public.live_unavailability_patch(v_row);
      when 'outing_reports' then
        update public.outing_reports
           set outing_summary = v_b ->> 'outing_summary', boat_feel = v_b ->> 'boat_feel',
               outing_successes = v_b ->> 'outing_successes', next_focus = v_b ->> 'next_focus',
               coach_feedback = v_b ->> 'coach_feedback', updated_by = p_actor
         where outing_id = v_b ->> 'outing_id'
        returning to_jsonb(outing_reports.*) into v_row;
        v_notion := 'outing'; v_page := v_b ->> 'outing_id';
        v_patch := v_patch || public.live_report_patch(v_row,
                     array['outing_summary', 'boat_feel', 'outing_successes', 'next_focus', 'coach_feedback']);
      else
        return public.live_invalid('this change cannot be undone');
    end case;
    v_new := v_new || jsonb_build_array(v_row);
  end loop;

  v_change := public.live_log(p_actor, v_log.entity, v_log.entity_key,
                              case when jsonb_typeof(v_log.before) = 'array' then v_now else v_now -> 0 end,
                              case when jsonb_typeof(v_log.after) = 'array' then v_new else v_new -> 0 end);
  update public.change_log set undone_by = v_change where id = p_change_id;
  perform public.enqueue_notion_outbox(v_notion, jsonb_build_object('page_id', v_page), v_patch);

  if v_log.entity = 'outing_seats' then
    v_outing := public.recompute_outing_status(v_page, p_flag_status,
                  array(select e ->> 'status' from jsonb_array_elements(v_new) as e));
  end if;

  return public.live_ok(v_change, v_new -> 0, v_outing)
         || case when jsonb_array_length(v_new) > 1 then jsonb_build_object('rows', v_new) else '{}'::jsonb end;
end;
$$;

-- ================================================================ grants
-- Supabase grants EXECUTE on new public functions to anon and authenticated by
-- default; take it all back. Only the server (service role) calls the RPCs.

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.proname like 'live\_%' or p.proname in (
              'recompute_outing_status', 'claim_seat', 'set_seat_status', 'swap_seats', 'claim_test_slot',
              'set_test_outcome', 'claim_marshal_slot', 'save_unavailability', 'save_outing_report', 'undo_change'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end;
$$;

grant execute on function
  public.claim_seat(text, text, text, text, text, integer, text),
  public.set_seat_status(text, text, text, text, text, text),
  public.swap_seats(text, text, text, text, integer, integer, text),
  public.claim_test_slot(text, integer, text, text, integer),
  public.set_test_outcome(text, integer, text, text, text),
  public.claim_marshal_slot(text, text, text, integer),
  public.save_unavailability(text, jsonb, text, integer),
  public.save_outing_report(text, jsonb, text, integer),
  public.undo_change(bigint, text, text)
  to service_role;
