-- PER-275 (B3): run the Notion <-> Postgres sync every minute, plus a nightly
-- full sweep (which also picks up deletions), by calling the app's protected
-- /api/sync/run route from pg_cron via pg_net.
--
-- The shared secret is NOT in this file. The jobs read it at run time from
-- Supabase Vault under the name 'sync_shared_secret'; until that secret exists
-- the route answers 401 and nothing happens. To set or rotate it, add/update
-- the Vault secret and the Vercel SYNC_SHARED_SECRET env var to the same value.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;

-- One function builds the request, so both jobs stay one line each.
create or replace function public.trigger_notion_sync(p_full boolean default false)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'sync_shared_secret';
  if v_secret is null or v_secret = '' then
    return null;   -- not configured (e.g. local or CI databases): make no request
  end if;
  return net.http_post(
    url     := 'https://sabcoxford.com/api/sync/run' || case when p_full then '?full=1' else '' end,
    headers := jsonb_build_object('content-type', 'application/json', 'x-sync-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000);
end;
$$;

revoke execute on function public.trigger_notion_sync(boolean) from public, anon, authenticated;

comment on function public.trigger_notion_sync(boolean) is
  'Calls /api/sync/run (inbound Notion sweep + outbox worker). Scheduled by pg_cron; secret from Vault.';

select cron.schedule('notion-sync', '* * * * *', $$ select public.trigger_notion_sync(false) $$);
select cron.schedule('notion-sync-full', '17 3 * * *', $$ select public.trigger_notion_sync(true) $$);
