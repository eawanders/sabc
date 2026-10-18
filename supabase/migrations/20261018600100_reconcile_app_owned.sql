-- PER-275 follow-up: reconcile APP-OWNED fields from Notion during the inbound sync.
--
-- During the side-by-side beta the current app still writes seats, seat
-- statuses, weekly unavailability, swim-test slots, marshal sign-ups and outing
-- reports straight to Notion. The inbound sync calls these functions with
-- Notion's values for every page it reads (incremental: pages edited since the
-- cursor; the nightly full sweep: every page). Per FIELD:
--
--   equal                       -> nothing.
--   pending                     -> a pending notion_outbox row for the page has
--                                  that Notion property: keep the DB (the app's
--                                  newer value is on its way to Notion).
--   newer                       -> the row's last APP write (updated_by not null)
--                                  is later than the page's last_edited_time:
--                                  keep the DB, and report it (kept_newer).
--   take                        -> write Notion's value: version bumps (trigger),
--                                  updated_by = null, one change_log row per row
--                                  with actor null and source = 'notion', and NO
--                                  outbox write (no echo back to Notion).
--
-- Rows last written by the sync or the backfill (updated_by null) never count
-- as newer than Notion: Notion is where their value came from. (Without this, a
-- seat row created moments ago with a new outing would look newer than the
-- crew already filled in on that Notion page.)
--
-- Seats take the same per-outing advisory lock as the B4 seat RPCs
-- (live_lock_outing), so one-member-one-seat is checked against settled rows.
-- If Notion's state would put a member in two seats of one outing (a mid-edit
-- snapshot), the seats moving that member are skipped and reported; the rest
-- of the outing still applies, and moves between seats apply together.
--
-- Every page is applied in its own savepoint: a bad page is reported in
-- `skipped` and the rest of the batch goes on.
--
-- Result (jsonb): {"rows": <rows changed>, "kept_pending": <fields>,
--                  "kept_newer": [{entity, key, field}], "skipped": [{entity, key, reason}]}

-- ---------------------------------------------------------------- change_log.source
alter table public.change_log
  add column source text not null default 'app' check (source in ('app', 'notion'));

comment on column public.change_log.source is
  'app: a member''s write through the B4 RPCs (undoable by them). notion: taken from Notion by the inbound sync (actor null, never undoable).';

-- ---------------------------------------------------------------- helpers (internal, no grants)

create function public.sync_pending_payload(p_entity text, p_page text) returns jsonb
language sql stable set search_path = ''
as $$
  select payload from public.notion_outbox
   where entity = p_entity and entity_key = jsonb_build_object('page_id', p_page) and done_at is null;
$$;

-- p_app_written_at: the row's updated_at if its last write was an app write, else null.
create function public.sync_decide(
  p_db jsonb, p_notion jsonb, p_pending jsonb, p_key text, p_app_written_at timestamptz, p_edited_at timestamptz)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when coalesce(p_db, 'null'::jsonb) = coalesce(p_notion, 'null'::jsonb) then 'equal'
    when coalesce(p_pending ? p_key, false) then 'pending'
    when p_app_written_at is not null and p_edited_at is not null and p_app_written_at > p_edited_at then 'newer'
    else 'take'
  end;
$$;

create function public.sync_result_new() returns jsonb
language sql immutable set search_path = ''
as $$
  select '{"rows": 0, "kept_pending": 0, "kept_newer": [], "skipped": []}'::jsonb;
$$;

create function public.sync_note(p_res jsonb, p_decision text, p_entity text, p_key jsonb, p_field text) returns jsonb
language sql immutable set search_path = ''
as $$
  select case p_decision
    when 'pending' then jsonb_set(p_res, '{kept_pending}', to_jsonb((p_res ->> 'kept_pending')::int + 1))
    when 'newer' then jsonb_set(p_res, '{kept_newer}', (p_res -> 'kept_newer')
                       || jsonb_build_array(jsonb_build_object('entity', p_entity, 'key', p_key, 'field', p_field)))
    else p_res
  end;
$$;

create function public.sync_skip(p_res jsonb, p_entity text, p_key jsonb, p_reason text) returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_set(p_res, '{skipped}', (p_res -> 'skipped')
           || jsonb_build_array(jsonb_build_object('entity', p_entity, 'key', p_key, 'reason', p_reason)));
$$;

create function public.sync_count_row(p_res jsonb) returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_set(p_res, '{rows}', to_jsonb((p_res ->> 'rows')::int + 1));
$$;

create function public.sync_log(p_entity text, p_key jsonb, p_before jsonb, p_after jsonb) returns bigint
language sql volatile set search_path = ''
as $$
  insert into public.change_log (actor_member_id, entity, entity_key, before, after, source)
  values (null, p_entity, p_key, p_before, p_after, 'notion')
  returning id;
$$;

create function public.sync_seat_status_key(p_seat text) returns text
language sql immutable set search_path = ''
as $$
  select case when p_seat = 'Coach/Bank Rider' then 'Bank Rider Status' else p_seat || ' Status' end;
$$;

-- [{start, end}] with only those keys, in order; anything else -> [].
create function public.sync_norm_ranges(p jsonb) returns jsonb
language sql immutable set search_path = ''
as $$
  select case when jsonb_typeof(p) = 'array' then coalesce(
           (select jsonb_agg(jsonb_build_object('start', e ->> 'start', 'end', e ->> 'end') order by i)
              from jsonb_array_elements(p) with ordinality as t (e, i)),
           '[]'::jsonb)
         else '[]'::jsonb end;
$$;

-- Report text compares on content: null, '' and surrounding whitespace are equal.
create function public.sync_norm_text(p text) returns jsonb
language sql immutable set search_path = ''
as $$
  select to_jsonb(nullif(btrim(p), ''));
$$;

-- ================================================================ seats

create function public.sync_reconcile_outing_seats(p_item jsonb, p_res jsonb) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
  v_res     jsonb := p_res;
  v_outing  text := p_item ->> 'outing_id';
  v_edited  timestamptz := (p_item ->> 'edited_at')::timestamptz;
  v_pending jsonb;
  v_n       jsonb;
  v_e       jsonb;
  v_row     public.outing_seats;
  v_after   public.outing_seats;
  v_app_at  timestamptz;
  v_dm      text;
  v_ds      text;
  v_plan    jsonb := '[]';
  v_dup     text;
  v_key     jsonb;
begin
  if not exists (select 1 from public.outings where id = v_outing) then
    return public.sync_skip(v_res, 'outing_seats', jsonb_build_object('outing_id', v_outing), 'unknown outing');
  end if;

  perform public.live_lock_outing(v_outing);
  v_pending := public.sync_pending_payload('outing', v_outing);

  for v_n in select * from jsonb_array_elements(coalesce(p_item -> 'seats', '[]')) loop
    v_key := jsonb_build_object('outing_id', v_outing, 'seat', v_n ->> 'seat');
    select * into v_row from public.outing_seats where outing_id = v_outing and seat = v_n ->> 'seat' for update;
    if not found then
      v_res := public.sync_skip(v_res, 'outing_seats', v_key, 'unknown seat');
      continue;
    end if;
    v_app_at := case when v_row.updated_by is not null then v_row.updated_at end;

    v_dm := public.sync_decide(to_jsonb(v_row.member_id), v_n -> 'member_id', v_pending, v_row.seat, v_app_at, v_edited);
    if v_dm = 'take' and v_n ->> 'member_id' is not null and not public.live_member_exists(v_n ->> 'member_id') then
      v_res := public.sync_skip(v_res, 'outing_seats', v_key, 'unknown member');
      v_dm := 'skip';
    end if;
    v_ds := public.sync_decide(to_jsonb(v_row.status), v_n -> 'status', v_pending,
                               public.sync_seat_status_key(v_row.seat), v_app_at, v_edited);
    if v_ds = 'take' and v_n ->> 'status' is not null and not (v_n ->> 'status' = any (public.live_seat_statuses())) then
      v_res := public.sync_skip(v_res, 'outing_seats', v_key, 'unknown status');
      v_ds := 'skip';
    end if;
    v_res := public.sync_note(v_res, v_dm, 'outing_seats', v_key, 'member_id');
    v_res := public.sync_note(v_res, v_ds, 'outing_seats', v_key, 'status');

    if v_dm = 'take' or v_ds = 'take' then
      v_plan := v_plan || jsonb_build_array(jsonb_build_object(
        'seat', v_row.seat,
        'member_id', case when v_dm = 'take' then v_n -> 'member_id' else to_jsonb(v_row.member_id) end,
        'status', case when v_ds = 'take' then v_n -> 'status' else to_jsonb(v_row.status) end,
        'member_changed', v_dm = 'take'));
    end if;
  end loop;

  -- One member, one seat: drop the moves that would seat a member twice.
  loop
    v_dup := null;
    select f.m into v_dup
      from (select case when p.seat is not null then p.member_id else s.member_id end as m,
                   coalesce(p.member_changed, false) as changed
              from public.outing_seats s
              left join (select e ->> 'seat' as seat, e ->> 'member_id' as member_id,
                                (e ->> 'member_changed')::boolean as member_changed
                           from jsonb_array_elements(v_plan) as e) p on p.seat = s.seat
             where s.outing_id = v_outing) f
     where f.m is not null
     group by f.m
    having count(*) > 1 and bool_or(f.changed)
     limit 1;
    exit when v_dup is null;
    v_res := public.sync_skip(v_res, 'outing_seats', jsonb_build_object('outing_id', v_outing, 'member_id', v_dup),
                              'would put one member in two seats');
    v_plan := (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(v_plan) as e
                where not ((e ->> 'member_changed')::boolean and e ->> 'member_id' = v_dup));
  end loop;

  for v_e in select * from jsonb_array_elements(v_plan) loop
    select * into v_row from public.outing_seats where outing_id = v_outing and seat = v_e ->> 'seat';
    update public.outing_seats
       set member_id = v_e ->> 'member_id', status = v_e ->> 'status', updated_by = null
     where outing_id = v_outing and seat = v_e ->> 'seat'
    returning * into v_after;
    perform public.sync_log('outing_seats', jsonb_build_object('outing_id', v_outing, 'seat', v_after.seat),
                            to_jsonb(v_row), to_jsonb(v_after));
    v_res := public.sync_count_row(v_res);
  end loop;
  return v_res;
end;
$$;

-- p_items: [{"outing_id", "edited_at", "seats": [{"seat", "member_id", "status"}]}]
create function public.sync_reconcile_seats(p_items jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_res  jsonb := public.sync_result_new();
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    begin
      v_res := public.sync_reconcile_outing_seats(v_item, v_res);
    exception when others then
      v_res := public.sync_skip(v_res, 'outing_seats', jsonb_build_object('outing_id', v_item ->> 'outing_id'), sqlerrm);
    end;
  end loop;
  return v_res;
end;
$$;

-- ================================================================ swim-test slots

create function public.sync_reconcile_test(p_item jsonb, p_res jsonb) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
  v_res     jsonb := p_res;
  v_test    text := p_item ->> 'test_id';
  v_edited  timestamptz := (p_item ->> 'edited_at')::timestamptz;
  v_pending jsonb;
  v_n       jsonb;
  v_row     public.swim_test_slots;
  v_after   public.swim_test_slots;
  v_app_at  timestamptz;
  v_dm      text;
  v_do      text;
  v_key     jsonb;
begin
  if not exists (select 1 from public.swim_tests where id = v_test) then
    return public.sync_skip(v_res, 'swim_test_slots', jsonb_build_object('test_id', v_test), 'unknown test');
  end if;
  v_pending := public.sync_pending_payload('swim_test', v_test);

  for v_n in select * from jsonb_array_elements(coalesce(p_item -> 'slots', '[]')) loop
    v_key := jsonb_build_object('test_id', v_test, 'slot', (v_n ->> 'slot')::int);
    select * into v_row from public.swim_test_slots
     where test_id = v_test and slot = (v_n ->> 'slot')::smallint for update;
    if not found then
      v_res := public.sync_skip(v_res, 'swim_test_slots', v_key, 'unknown slot');
      continue;
    end if;
    v_app_at := case when v_row.updated_by is not null then v_row.updated_at end;
    v_dm := public.sync_decide(to_jsonb(v_row.member_id), v_n -> 'member_id', v_pending, 'Slot ' || v_row.slot, v_app_at, v_edited);
    if v_dm = 'take' and v_n ->> 'member_id' is not null and not public.live_member_exists(v_n ->> 'member_id') then
      v_res := public.sync_skip(v_res, 'swim_test_slots', v_key, 'unknown member');
      v_dm := 'skip';
    end if;
    v_do := public.sync_decide(to_jsonb(v_row.outcome), v_n -> 'outcome', v_pending,
                               'Slot ' || v_row.slot || ' Outcome', v_app_at, v_edited);
    if v_do = 'take' and v_n ->> 'outcome' is not null
       and not (v_n ->> 'outcome' = any (array['No Show', 'Test Booked', 'Failed', 'Passed'])) then
      v_res := public.sync_skip(v_res, 'swim_test_slots', v_key, 'unknown outcome');
      v_do := 'skip';
    end if;
    v_res := public.sync_note(v_res, v_dm, 'swim_test_slots', v_key, 'member_id');
    v_res := public.sync_note(v_res, v_do, 'swim_test_slots', v_key, 'outcome');
    continue when v_dm <> 'take' and v_do <> 'take';

    update public.swim_test_slots
       set member_id = case when v_dm = 'take' then v_n ->> 'member_id' else member_id end,
           outcome   = case when v_do = 'take' then v_n ->> 'outcome' else outcome end,
           updated_by = null
     where test_id = v_test and slot = v_row.slot
    returning * into v_after;
    perform public.sync_log('swim_test_slots', jsonb_build_object('test_id', v_test, 'slot', v_row.slot),
                            to_jsonb(v_row), to_jsonb(v_after));
    v_res := public.sync_count_row(v_res);
  end loop;
  return v_res;
end;
$$;

-- p_items: [{"test_id", "edited_at", "slots": [{"slot", "member_id", "outcome"}]}]
create function public.sync_reconcile_test_slots(p_items jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_res  jsonb := public.sync_result_new();
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    begin
      v_res := public.sync_reconcile_test(v_item, v_res);
    exception when others then
      v_res := public.sync_skip(v_res, 'swim_test_slots', jsonb_build_object('test_id', v_item ->> 'test_id'), sqlerrm);
    end;
  end loop;
  return v_res;
end;
$$;

-- ================================================================ marshal sign-ups

create function public.sync_reconcile_marshal(p_item jsonb, p_res jsonb) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
  v_res     jsonb := p_res;
  v_id      text := p_item ->> 'id';
  v_edited  timestamptz := (p_item ->> 'edited_at')::timestamptz;
  v_pending jsonb;
  v_row     public.marshal_slots;
  v_after   public.marshal_slots;
  v_app_at  timestamptz;
  v_dp      text;
  v_ds      text;
  v_key     jsonb := jsonb_build_object('id', p_item ->> 'id');
begin
  select * into v_row from public.marshal_slots where id = v_id for update;
  if not found then
    return public.sync_skip(v_res, 'marshal_slots', v_key, 'unknown marshal slot');
  end if;
  v_pending := public.sync_pending_payload('marshal_slot', v_id);
  v_app_at := case when v_row.updated_by is not null then v_row.updated_at end;

  v_dp := public.sync_decide(to_jsonb(v_row.person_id), p_item -> 'person_id', v_pending, 'Person', v_app_at, v_edited);
  if v_dp = 'take' and p_item ->> 'person_id' is not null and not public.live_member_exists(p_item ->> 'person_id') then
    v_res := public.sync_skip(v_res, 'marshal_slots', v_key, 'unknown member');
    v_dp := 'skip';
  end if;
  v_ds := public.sync_decide(to_jsonb(v_row.person_status), p_item -> 'person_status', v_pending, 'Person Status', v_app_at, v_edited);
  if v_ds = 'take' and not coalesce(p_item ->> 'person_status' = any (array[
       'Open', 'Reserved', 'Maybe Available', 'Awaiting Approval', 'Confirmed', 'Not Available']), false) then
    v_res := public.sync_skip(v_res, 'marshal_slots', v_key, 'unknown person status');
    v_ds := 'skip';
  end if;
  v_res := public.sync_note(v_res, v_dp, 'marshal_slots', v_key, 'person_id');
  v_res := public.sync_note(v_res, v_ds, 'marshal_slots', v_key, 'person_status');
  if v_dp <> 'take' and v_ds <> 'take' then
    return v_res;
  end if;

  update public.marshal_slots
     set person_id     = case when v_dp = 'take' then p_item ->> 'person_id' else person_id end,
         person_status = case when v_ds = 'take' then p_item ->> 'person_status' else person_status end,
         updated_by    = null
   where id = v_id
  returning * into v_after;
  perform public.sync_log('marshal_slots', v_key, to_jsonb(v_row), to_jsonb(v_after));
  return public.sync_count_row(v_res);
end;
$$;

-- p_items: [{"id", "edited_at", "person_id", "person_status"}]
create function public.sync_reconcile_marshal_slots(p_items jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_res  jsonb := public.sync_result_new();
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    begin
      v_res := public.sync_reconcile_marshal(v_item, v_res);
    exception when others then
      v_res := public.sync_skip(v_res, 'marshal_slots', jsonb_build_object('id', v_item ->> 'id'), sqlerrm);
    end;
  end loop;
  return v_res;
end;
$$;

-- ================================================================ weekly unavailability

create function public.sync_reconcile_member_unavailability(p_item jsonb, p_res jsonb) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
  v_res     jsonb := p_res;
  v_member  text := p_item ->> 'member_id';
  v_edited  timestamptz := (p_item ->> 'edited_at')::timestamptz;
  v_pending jsonb;
  v_row     public.member_unavailability;
  v_after   public.member_unavailability;
  v_db      jsonb;
  v_app_at  timestamptz;
  v_day     text;
  v_d       text;
  v_take    text[] := '{}';
  v_new     jsonb := '{}';
  v_key     jsonb := jsonb_build_object('member_id', p_item ->> 'member_id');
begin
  -- Members without a row in members (nameless form submissions) are not synced.
  if not public.live_member_exists(v_member) then
    return v_res;
  end if;
  v_pending := public.sync_pending_payload('member', v_member);
  select * into v_row from public.member_unavailability where member_id = v_member for update;
  v_db := coalesce(to_jsonb(v_row), '{}'::jsonb);
  v_app_at := case when v_row.updated_by is not null then v_row.updated_at end;

  foreach v_day in array array['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] loop
    v_d := public.sync_decide(public.sync_norm_ranges(v_db -> v_day),
                              public.sync_norm_ranges(p_item -> 'days' -> v_day),
                              v_pending, 'Unavailable ' || initcap(v_day), v_app_at, v_edited);
    v_res := public.sync_note(v_res, v_d, 'member_unavailability', v_key, v_day);
    if v_d = 'take' then
      v_take := v_take || v_day;
      v_new := v_new || jsonb_build_object(v_day, public.sync_norm_ranges(p_item -> 'days' -> v_day));
    end if;
  end loop;
  if cardinality(v_take) = 0 then
    return v_res;
  end if;

  if v_row.member_id is null then
    insert into public.member_unavailability (member_id) values (v_member) on conflict do nothing;
    select * into v_row from public.member_unavailability where member_id = v_member for update;
  end if;

  update public.member_unavailability
     set monday    = coalesce(v_new -> 'monday', monday),
         tuesday   = coalesce(v_new -> 'tuesday', tuesday),
         wednesday = coalesce(v_new -> 'wednesday', wednesday),
         thursday  = coalesce(v_new -> 'thursday', thursday),
         friday    = coalesce(v_new -> 'friday', friday),
         saturday  = coalesce(v_new -> 'saturday', saturday),
         sunday    = coalesce(v_new -> 'sunday', sunday),
         updated_by = null
   where member_id = v_member
  returning * into v_after;
  perform public.sync_log('member_unavailability', v_key, to_jsonb(v_row), to_jsonb(v_after));
  return public.sync_count_row(v_res);
end;
$$;

-- p_items: [{"member_id", "edited_at", "days": {"monday": [{start, end}], ...}}]
create function public.sync_reconcile_unavailability(p_items jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_res  jsonb := public.sync_result_new();
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    begin
      v_res := public.sync_reconcile_member_unavailability(v_item, v_res);
    exception when others then
      v_res := public.sync_skip(v_res, 'member_unavailability', jsonb_build_object('member_id', v_item ->> 'member_id'), sqlerrm);
    end;
  end loop;
  return v_res;
end;
$$;

-- ================================================================ outing reports

create function public.sync_reconcile_report(p_item jsonb, p_res jsonb) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
  v_res     jsonb := p_res;
  v_outing  text := p_item ->> 'outing_id';
  v_edited  timestamptz := (p_item ->> 'edited_at')::timestamptz;
  v_pending jsonb;
  v_row     public.outing_reports;
  v_after   public.outing_reports;
  v_db      jsonb;
  v_app_at  timestamptz;
  v_field   text;
  v_d       text;
  v_new     jsonb := '{}';
  v_key     jsonb := jsonb_build_object('outing_id', p_item ->> 'outing_id');
begin
  if not exists (select 1 from public.outings where id = v_outing) then
    return public.sync_skip(v_res, 'outing_reports', v_key, 'unknown outing');
  end if;
  v_pending := public.sync_pending_payload('outing', v_outing);
  select * into v_row from public.outing_reports where outing_id = v_outing for update;
  v_db := coalesce(to_jsonb(v_row), '{}'::jsonb);
  v_app_at := case when v_row.updated_by is not null then v_row.updated_at end;

  foreach v_field in array array['outing_summary', 'boat_feel', 'outing_successes', 'next_focus', 'coach_feedback'] loop
    v_d := public.sync_decide(public.sync_norm_text(v_db ->> v_field),
                              public.sync_norm_text(p_item -> 'fields' ->> v_field),
                              v_pending, public.live_report_property(v_field), v_app_at, v_edited);
    v_res := public.sync_note(v_res, v_d, 'outing_reports', v_key, v_field);
    if v_d = 'take' then
      v_new := v_new || jsonb_build_object(v_field, public.sync_norm_text(p_item -> 'fields' ->> v_field));
    end if;
  end loop;
  if v_new = '{}'::jsonb then
    return v_res;
  end if;

  if v_row.outing_id is null then
    insert into public.outing_reports (outing_id) values (v_outing) on conflict do nothing;
    select * into v_row from public.outing_reports where outing_id = v_outing for update;
  end if;

  update public.outing_reports
     set outing_summary   = case when v_new ? 'outing_summary' then v_new ->> 'outing_summary' else outing_summary end,
         boat_feel        = case when v_new ? 'boat_feel' then v_new ->> 'boat_feel' else boat_feel end,
         outing_successes = case when v_new ? 'outing_successes' then v_new ->> 'outing_successes' else outing_successes end,
         next_focus       = case when v_new ? 'next_focus' then v_new ->> 'next_focus' else next_focus end,
         coach_feedback   = case when v_new ? 'coach_feedback' then v_new ->> 'coach_feedback' else coach_feedback end,
         updated_by       = null
   where outing_id = v_outing
  returning * into v_after;
  perform public.sync_log('outing_reports', v_key, to_jsonb(v_row), to_jsonb(v_after));
  return public.sync_count_row(v_res);
end;
$$;

-- p_items: [{"outing_id", "edited_at", "fields": {"outing_summary": text|null, ...}}]
create function public.sync_reconcile_reports(p_items jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_res  jsonb := public.sync_result_new();
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    begin
      v_res := public.sync_reconcile_report(v_item, v_res);
    exception when others then
      v_res := public.sync_skip(v_res, 'outing_reports', jsonb_build_object('outing_id', v_item ->> 'outing_id'), sqlerrm);
    end;
  end loop;
  return v_res;
end;
$$;

-- ================================================================ grants
-- Supabase grants EXECUTE on new public functions to anon and authenticated by
-- default; take it all back. Only the five batch entry points are callable,
-- and only by the server (service role).

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.proname like 'sync\_reconcile\_%' or p.proname in (
              'sync_pending_payload', 'sync_decide', 'sync_result_new', 'sync_note', 'sync_skip',
              'sync_count_row', 'sync_log', 'sync_seat_status_key', 'sync_norm_ranges', 'sync_norm_text'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end;
$$;

grant execute on function
  public.sync_reconcile_seats(jsonb),
  public.sync_reconcile_test_slots(jsonb),
  public.sync_reconcile_marshal_slots(jsonb),
  public.sync_reconcile_unavailability(jsonb),
  public.sync_reconcile_reports(jsonb)
  to service_role;
