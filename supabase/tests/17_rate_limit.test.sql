-- PER-278: the API rate limiter's store. A fixed-window counter per key: the
-- first p_max hits in a window are allowed, the rest refused; a new window
-- starts again at zero. Expired windows are swept by pg_cron.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select is(public.rate_limit_hit('k1', 60, 3), true, 'hit 1 of 3 allowed');
select is(public.rate_limit_hit('k1', 60, 3), true, 'hit 2 of 3 allowed');
select is(public.rate_limit_hit('k1', 60, 3), true, 'hit 3 of 3 allowed');
select is(public.rate_limit_hit('k1', 60, 3), false, 'hit 4 refused');
select is(public.rate_limit_hit('k2', 60, 3), true, 'another key has its own count');
select is((select count(*)::int from public.rate_limit_hits), 2, 'one row per key and window, not per hit');

-- Move k1's window into the past: the next hit starts a fresh window
update public.rate_limit_hits set window_start = window_start - interval '120 seconds',
                                  expires_at = expires_at - interval '120 seconds' where key = 'k1';
select is(public.rate_limit_hit('k1', 60, 3), true, 'a new window starts again at zero');

-- Cleanup deletes expired windows only
select is(public.rate_limit_cleanup(), 1, 'the expired window is swept');
select is((select count(*)::int from public.rate_limit_hits), 2, 'current windows are kept');
select is((select schedule from cron.job where jobname = 'rate-limit-cleanup'), '*/10 * * * *', 'cleanup is scheduled');

-- Server only
select ok(not has_function_privilege('anon', 'public.rate_limit_hit(text, integer, integer)', 'execute'), 'anon cannot hit');
select ok(has_function_privilege('service_role', 'public.rate_limit_hit(text, integer, integer)', 'execute'),
  'service_role can hit');

select * from finish();
rollback;
