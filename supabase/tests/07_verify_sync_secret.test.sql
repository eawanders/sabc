-- PER-275: verify_sync_secret compares against Vault and is server-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(public.verify_sync_secret('anything'), false, 'false when no secret is stored');
select vault.create_secret('test-secret-value', 'sync_shared_secret');
select is(public.verify_sync_secret('test-secret-value'), true, 'true for the stored secret');
select is(public.verify_sync_secret('wrong'), false, 'false for a wrong secret');
select is(public.verify_sync_secret(''), false, 'false for an empty secret');
select ok(not has_function_privilege('anon', 'public.verify_sync_secret(text)', 'EXECUTE'),
  'anon cannot call it');

select * from finish();
rollback;
