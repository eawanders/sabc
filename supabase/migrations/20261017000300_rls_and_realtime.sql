-- PER-274 (Phase B2): access and Realtime.
--
-- Writes go only through server routes using the service role (which bypasses
-- RLS). The browser holds the anon key and may only READ member-facing tables
-- and subscribe to Realtime. Write privileges are revoked outright, not just
-- left without a policy, so a stray client write errors instead of silently
-- matching zero rows.

do $$
declare
  t text;
begin
  foreach t in array array[
    'members', 'outings', 'outing_seats', 'outing_reports', 'member_unavailability',
    'events', 'swim_tests', 'swim_test_slots', 'marshal_slots', 'change_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy "Public read" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end;
$$;

-- The outbox is server-only: RLS on, no policy, no grants.
alter table public.notion_outbox enable row level security;
revoke all on public.notion_outbox from anon, authenticated;

revoke all on sequence public.change_log_id_seq, public.notion_outbox_id_seq from anon, authenticated;

revoke execute on function
  public.enqueue_notion_outbox(text, jsonb, jsonb),
  public.complete_notion_outbox(bigint, integer)
  from public, anon, authenticated;

-- Realtime. FULL replica identity so UPDATE/DELETE events carry the old row
-- (e.g. who held a seat before it changed).
do $$
declare
  t text;
begin
  foreach t in array array[
    'outings', 'outing_seats', 'outing_reports', 'member_unavailability', 'swim_test_slots', 'marshal_slots'
  ] loop
    execute format('alter table public.%I replica identity full', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end;
$$;
