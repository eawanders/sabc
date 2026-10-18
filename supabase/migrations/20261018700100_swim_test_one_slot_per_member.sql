-- PER-278: one member, one slot per swim test.
--
-- claim_test_slot checked only the slot's version, so two devices booking the
-- same member into two different slots of one test at once (or a coach placing
-- someone already booked) both won. Now, as claim_seat does for seats:
--   * every slot write on a test is serialised by an advisory lock on the test
--     (live_lock_test, like live_lock_outing), so the check below always sees
--     the rows the previous write left;
--   * placing a member who already holds another slot of the same test is a
--     conflict carrying that slot's row and "held_slot": <its number>. Nothing is
--     written. Moving yourself is clear-then-book (the UI already offers both);
--     there is no implicit move, matching claim_seat, where a move is a swap.
--   * undo_change keeps the same rule when it restores a member into a slot.
--
-- No unique index: Notion lets one person sit in two slot relations, and the
-- backfill / inbound sync copy each slot as it is, so production may already
-- hold such rows. They stay readable and clearable; only new duplicates are
-- refused. Both functions are replaced in place (same signatures), which keeps
-- their grants (service_role only).

create or replace function public.live_lock_test(p_test_id text) returns void
language sql volatile set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('sabc.swim_test_slots:' || p_test_id, 0));
$$;

revoke all on function public.live_lock_test(text) from public, anon, authenticated, service_role;

-- ================================================================ claim_test_slot
-- Book a slot (or clear it). As /api/assign-test-slot: booking sets the
-- outcome to 'Test Booked' unless it is already Passed / Failed / Test Booked;
-- clearing sets 'No Show'. A member holds at most one slot per test.
create or replace function public.claim_test_slot(
  p_test_id text, p_slot integer, p_member_id text, p_actor text, p_expected_version integer)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_before public.swim_test_slots;
  v_after  public.swim_test_slots;
  v_other  public.swim_test_slots;
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

  perform public.live_lock_test(p_test_id);

  select * into v_before from public.swim_test_slots where test_id = p_test_id and slot = p_slot for update;
  if not found then
    return public.live_not_found();
  end if;
  if v_before.version <> p_expected_version then
    return public.live_conflict(to_jsonb(v_before), v_before.member_id);
  end if;

  if p_member_id is not null then
    select * into v_other from public.swim_test_slots
     where test_id = p_test_id and member_id = p_member_id and slot <> p_slot
     order by slot
     limit 1;
    if found then
      return public.live_conflict(to_jsonb(v_other), v_other.member_id) || jsonb_build_object('held_slot', v_other.slot);
    end if;
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

-- ================================================================ undo_change
-- As before (20261018100100), plus: a swim-test slot undo takes the test lock and
-- refuses to restore a member who now holds another slot of that test.
create or replace function public.undo_change(p_change_id bigint, p_actor text, p_flag_status text default null)
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
  v_dup_slot public.swim_test_slots;
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
  elsif v_log.entity = 'swim_test_slots' then
    perform public.live_lock_test(v_log.entity_key ->> 'test_id');
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

  -- 2b. Swim-test slots: likewise, one slot per member per test
  if v_log.entity = 'swim_test_slots' then
    v_b := v_befores -> 0;
    if v_b ->> 'member_id' is not null then
      select * into v_dup_slot from public.swim_test_slots
       where test_id = v_b ->> 'test_id' and member_id = v_b ->> 'member_id' and slot <> (v_b ->> 'slot')::smallint
       order by slot
       limit 1;
      if found then
        return public.live_conflict(to_jsonb(v_dup_slot), v_dup_slot.member_id) || jsonb_build_object('held_slot', v_dup_slot.slot);
      end if;
    end if;
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
