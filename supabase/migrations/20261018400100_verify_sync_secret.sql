-- PER-275 (B3): /api/sync/run checks its x-sync-secret header against the
-- Vault secret 'sync_shared_secret' through this function, so the secret is
-- created and used only inside the database and never copied into Vercel.
-- Returns false when no secret is stored or the candidate is empty.

create or replace function public.verify_sync_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_secret, '') <> '' and exists (
    select 1 from vault.decrypted_secrets
     where name = 'sync_shared_secret' and decrypted_secret = p_secret);
$$;

revoke execute on function public.verify_sync_secret(text) from public, anon, authenticated;
grant execute on function public.verify_sync_secret(text) to service_role;
