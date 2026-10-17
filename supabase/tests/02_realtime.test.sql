-- Realtime: live tables are published with full row images.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(
  exists (select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t),
  t || ' is in supabase_realtime')
from unnest(array['outings', 'outing_seats', 'outing_reports', 'member_unavailability', 'swim_test_slots', 'marshal_slots']) as t;

select is((select relreplident from pg_class where oid = ('public.' || t)::regclass), 'f'::"char",
  t || ' has REPLICA IDENTITY FULL')
from unnest(array['outings', 'outing_seats', 'outing_reports', 'member_unavailability', 'swim_test_slots', 'marshal_slots']) as t;

select ok(
  not exists (select 1 from pg_publication_tables
               where pubname = 'supabase_realtime' and tablename = 'notion_outbox'),
  'notion_outbox is not published');

select * from finish();
rollback;
