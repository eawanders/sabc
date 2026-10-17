-- PER-275 follow-up: ownership of outings.status, which both sides now write.
--
-- The app auto-confirms outings (PER-276): it writes outings.status and queues a
-- Notion "Status" patch through enqueue_notion_outbox. Captains also change
-- Status in Notion, notably to Cancelled. The inbound sync applies Notion's
-- value through sync_outing_status, which decides atomically:
--
--   1. Notion says Cancelled -> write Cancelled, and drop "Status" from the
--      page's pending outbox row (marking the row done if nothing is left), so
--      the app can never resurrect a cancelled outing in Notion.
--   2. Otherwise, if the page's pending outbox row carries "Status" -> keep the
--      app's value; it is newer and on its way to Notion.
--   3. Otherwise -> write Notion's value.
--
-- The outings row is locked first, so an app write to the same outing (which
-- updates that row and enqueues in one transaction) is serialised against it.

create function public.sync_outing_status(p_outing_id public.notion_id, p_notion_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status  text := case when p_notion_status in ('Confirmed', 'Provisional', 'Cancelled') then p_notion_status end;
  v_row     public.notion_outbox%rowtype;
  v_payload jsonb;
begin
  perform 1 from public.outings where id = p_outing_id for update;
  if not found then
    return 'missing';
  end if;

  select * into v_row
    from public.notion_outbox
   where entity = 'outing'
     and entity_key = jsonb_build_object('page_id', p_outing_id::text)
     and done_at is null
   for update;

  if v_status = 'Cancelled' then
    update public.outings set status = 'Cancelled' where id = p_outing_id;
    if v_row.id is not null and v_row.payload ? 'Status' then
      v_payload := v_row.payload - 'Status';
      -- Bumping revision means a worker already sending the old payload cannot
      -- complete the row with its stale revision.
      update public.notion_outbox
         set payload    = v_payload,
             revision   = revision + 1,
             updated_at = now(),
             done_at    = case when v_payload = '{}'::jsonb then now() end
       where id = v_row.id;
    end if;
    return 'cancelled';
  end if;

  if v_row.id is not null and v_row.payload ? 'Status' then
    return 'kept';
  end if;

  update public.outings set status = v_status where id = p_outing_id;
  return 'applied';
end;
$$;

comment on function public.sync_outing_status(public.notion_id, text) is
  'Applies Notion''s outing Status: Cancelled always wins (and drops a pending app Status patch); a pending app Status patch otherwise wins.';

-- One call per page of Notion results: [{"id": "<outing id>", "status": "<Notion status or null>"}].
create function public.sync_outing_statuses(p_statuses jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item  jsonb;
  v_count integer := 0;
begin
  for v_item in select * from jsonb_array_elements(p_statuses) loop
    perform public.sync_outing_status((v_item->>'id')::public.notion_id, v_item->>'status');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function
  public.sync_outing_status(public.notion_id, text),
  public.sync_outing_statuses(jsonb)
  from public, anon, authenticated;

grant execute on function
  public.sync_outing_status(public.notion_id, text),
  public.sync_outing_statuses(jsonb)
  to service_role;
