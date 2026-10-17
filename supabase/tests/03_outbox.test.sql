-- Outbox coalescing: one pending row per Notion page; later edits merge into it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select public.enqueue_notion_outbox('outing', '{"page_id":"bbbbbbbb-0000-4000-8000-000000000001"}',
  '{"Bow": {"relation": []}, "Bow Status": {"status": {"name": "Available"}}}');
select public.enqueue_notion_outbox('outing', '{"page_id":"bbbbbbbb-0000-4000-8000-000000000001"}',
  '{"Bow Status": {"status": {"name": "Reserved"}}}');
select public.enqueue_notion_outbox('outing', '{"page_id":"bbbbbbbb-0000-4000-8000-000000000001"}',
  '{"Stroke Status": {"status": {"name": "Maybe Available"}}}');

select is((select count(*)::int from public.notion_outbox where done_at is null), 1,
  'three edits to one page queue one pending write');
select is((select payload->'Bow Status'->'status'->>'name' from public.notion_outbox where done_at is null), 'Reserved',
  'latest value of a property wins');
select ok((select payload ? 'Bow' and payload ? 'Stroke Status' from public.notion_outbox where done_at is null),
  'properties from earlier edits are kept');
select is((select revision from public.notion_outbox where done_at is null), 3, 'revision counts the merged edits');

-- A different page gets its own row
select public.enqueue_notion_outbox('outing', '{"page_id":"bbbbbbbb-0000-4000-8000-000000000002"}', '{"Cox Status": {"status": {"name": "Available"}}}');
select is((select count(*)::int from public.notion_outbox where done_at is null), 2, 'another page queues separately');

-- Worker completes with the revision it sent; a stale revision leaves the row pending
select ok(not public.complete_notion_outbox(
            (select id from public.notion_outbox where entity_key->>'page_id' = 'bbbbbbbb-0000-4000-8000-000000000001'), 2),
  'completing a stale revision returns false');
select is((select count(*)::int from public.notion_outbox where done_at is null), 2,
  'the row edited mid-flight stays pending');
select ok(public.complete_notion_outbox(
            (select id from public.notion_outbox where entity_key->>'page_id' = 'bbbbbbbb-0000-4000-8000-000000000001'), 3),
  'completing the current revision returns true');
select is((select count(*)::int from public.notion_outbox where done_at is null), 1, 'completed row is no longer pending');

-- After completion, a new edit starts a fresh row
select public.enqueue_notion_outbox('outing', '{"page_id":"bbbbbbbb-0000-4000-8000-000000000001"}', '{"Bow Status": {"status": {"name": "Not Available"}}}');
select is((select count(*)::int from public.notion_outbox where entity_key->>'page_id' = 'bbbbbbbb-0000-4000-8000-000000000001'), 2,
  'an edit after completion queues a new row');
select is((select payload from public.notion_outbox
            where entity_key->>'page_id' = 'bbbbbbbb-0000-4000-8000-000000000001' and done_at is null),
  '{"Bow Status": {"status": {"name": "Not Available"}}}'::jsonb, 'the new row carries only the new edit');

-- The coalescing key is enforced by the database, not just by the function
select throws_ok($$ insert into public.notion_outbox (entity, entity_key, payload)
                    values ('outing', '{"page_id":"bbbbbbbb-0000-4000-8000-000000000002"}', '{}') $$,
  '23505', null, 'a second pending row for the same page is rejected');

select * from finish();
rollback;
