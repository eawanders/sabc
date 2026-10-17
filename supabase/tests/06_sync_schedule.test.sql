-- PER-275: the sync schedule exists and the trigger function is server-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is((select schedule from cron.job where jobname = 'notion-sync'), '* * * * *',
  'incremental sync runs every minute');
select is((select schedule from cron.job where jobname = 'notion-sync-full'), '17 3 * * *',
  'full sweep runs nightly at 03:17');
select ok((select command from cron.job where jobname = 'notion-sync') like '%trigger_notion_sync(false)%',
  'the minute job calls the incremental trigger');
select ok(not has_function_privilege('anon', 'public.trigger_notion_sync(boolean)', 'EXECUTE'),
  'anon cannot trigger a sync');
select ok(not exists (select 1 from cron.job where command ~* 'x-sync-secret.*[0-9a-f]{32}'),
  'no secret value is stored in the job text');

select is(public.trigger_notion_sync(false), null::bigint,
  'with no Vault secret the trigger makes no request');

select * from finish();
rollback;
