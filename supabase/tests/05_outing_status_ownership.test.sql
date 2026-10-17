-- PER-275 follow-up: who owns outings.status when Notion and the app both change it.
--   Cancelled in Notion       -> always wins; the app's pending Status patch is dropped.
--   App Status patch pending  -> Notion's (older) value is ignored until it is sent.
--   Otherwise                 -> Notion's value is written.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.outings (id, name, status) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'Pending status only', 'Confirmed'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'Pending status and seat', 'Confirmed'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'App confirmed, in flight', 'Confirmed'),
  ('eeeeeeee-0000-4000-8000-000000000004', 'Nothing pending', 'Provisional'),
  ('eeeeeeee-0000-4000-8000-000000000005', 'Seat pending only', 'Provisional');

select public.enqueue_notion_outbox('outing', '{"page_id":"eeeeeeee-0000-4000-8000-000000000001"}',
  '{"Status": {"status": {"name": "Confirmed"}}}');
select public.enqueue_notion_outbox('outing', '{"page_id":"eeeeeeee-0000-4000-8000-000000000002"}',
  '{"Status": {"status": {"name": "Confirmed"}}, "Bow Status": {"status": {"name": "Available"}}}');
select public.enqueue_notion_outbox('outing', '{"page_id":"eeeeeeee-0000-4000-8000-000000000003"}',
  '{"Status": {"status": {"name": "Confirmed"}}}');
select public.enqueue_notion_outbox('outing', '{"page_id":"eeeeeeee-0000-4000-8000-000000000005"}',
  '{"Bow Status": {"status": {"name": "Available"}}}');

-- 1. Cancelled in Notion always wins, and the pending Status patch is removed.
select is(public.sync_outing_status('eeeeeeee-0000-4000-8000-000000000001', 'Cancelled'), 'cancelled',
  'Cancelled reports the cancelled branch');
select is((select status from public.outings where id = 'eeeeeeee-0000-4000-8000-000000000001'), 'Cancelled',
  'Cancelled overwrites the app''s status');
select ok((select done_at is not null from public.notion_outbox
            where entity_key->>'page_id' = 'eeeeeeee-0000-4000-8000-000000000001'),
  'an outbox row left empty by removing Status is marked done');

select public.sync_outing_status('eeeeeeee-0000-4000-8000-000000000002', 'Cancelled');
select is((select payload from public.notion_outbox
            where entity_key->>'page_id' = 'eeeeeeee-0000-4000-8000-000000000002' and done_at is null),
  '{"Bow Status": {"status": {"name": "Available"}}}'::jsonb,
  'Cancelled removes only Status; other pending properties stay queued');
select is((select revision from public.notion_outbox
            where entity_key->>'page_id' = 'eeeeeeee-0000-4000-8000-000000000002' and done_at is null), 2,
  'removing Status bumps the revision so an in-flight send cannot complete the row');

-- 2. A pending app Status patch keeps the app's value.
select is(public.sync_outing_status('eeeeeeee-0000-4000-8000-000000000003', 'Provisional'), 'kept',
  'a pending Status patch reports the kept branch');
select is((select status from public.outings where id = 'eeeeeeee-0000-4000-8000-000000000003'), 'Confirmed',
  'Notion''s older status does not overwrite the app''s pending one');
select is((select payload from public.notion_outbox
            where entity_key->>'page_id' = 'eeeeeeee-0000-4000-8000-000000000003' and done_at is null),
  '{"Status": {"status": {"name": "Confirmed"}}}'::jsonb, 'the pending patch is untouched');

-- 3. Nothing pending (or pending without Status): Notion's value is written.
select is(public.sync_outing_status('eeeeeeee-0000-4000-8000-000000000004', 'Confirmed'), 'applied',
  'no pending Status reports the applied branch');
select is((select status from public.outings where id = 'eeeeeeee-0000-4000-8000-000000000004'), 'Confirmed',
  'Notion''s status is written');
select public.sync_outing_status('eeeeeeee-0000-4000-8000-000000000005', 'Confirmed');
select is((select status from public.outings where id = 'eeeeeeee-0000-4000-8000-000000000005'), 'Confirmed',
  'a pending patch without Status does not block Notion''s status');
select public.sync_outing_status('eeeeeeee-0000-4000-8000-000000000005', 'Postponed');
select is((select status from public.outings where id = 'eeeeeeee-0000-4000-8000-000000000005'), null,
  'a status the schema does not allow is stored as null');

-- Once the app's patch has been sent, Notion's value applies again.
update public.notion_outbox set done_at = now() where entity_key->>'page_id' = 'eeeeeeee-0000-4000-8000-000000000003';
select public.sync_outing_status('eeeeeeee-0000-4000-8000-000000000003', 'Provisional');
select is((select status from public.outings where id = 'eeeeeeee-0000-4000-8000-000000000003'), 'Provisional',
  'after the patch is sent, Notion''s status is written');

-- Batch form used by the sync.
select is(public.sync_outing_statuses(
  '[{"id": "eeeeeeee-0000-4000-8000-000000000004", "status": "Cancelled"},
    {"id": "eeeeeeee-0000-4000-8000-000000000005", "status": "Provisional"}]'), 2,
  'the batch form applies each row');
select is((select array_agg(status order by id) from public.outings
            where id in ('eeeeeeee-0000-4000-8000-000000000004', 'eeeeeeee-0000-4000-8000-000000000005')),
  array['Cancelled', 'Provisional'], 'the batch form follows the same rule');

-- Server-only.
select ok(not has_function_privilege('anon', 'public.sync_outing_statuses(jsonb)', 'execute')
          and not has_function_privilege('authenticated', 'public.sync_outing_status(public.notion_id, text)', 'execute')
          and has_function_privilege('service_role', 'public.sync_outing_statuses(jsonb)', 'execute'),
  'only service_role may run the status functions');

select * from finish();
rollback;
