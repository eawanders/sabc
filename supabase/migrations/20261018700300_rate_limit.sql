-- PER-278: the API rate limiter's store, in Postgres instead of Upstash Redis.
--
-- Production never had the Upstash env vars, so every limit failed open. This
-- is a fixed-window counter: one row per (key, window), bumped by one upsert.
-- rate_limit_hit(key, window_seconds, max) returns true while the hit is within
-- the limit, false once it is over. src/app/api/_utils/rate-limit.ts calls it
-- once per request and fails open if the call errors.
--
-- Expired windows are deleted every 10 minutes by pg_cron.

create table if not exists public.rate_limit_hits (
  key          text not null,
  window_start timestamptz not null,
  expires_at   timestamptz not null,
  hits         integer not null default 1,
  primary key (key, window_start)
);

create index if not exists rate_limit_hits_expires_at_idx on public.rate_limit_hits (expires_at);

comment on table public.rate_limit_hits is
  'Fixed-window request counters for the API rate limiter (PER-278). Server only; swept by pg_cron.';

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_start timestamptz;
  v_hits  integer;
begin
  if p_key is null or p_window_seconds is null or p_window_seconds < 1 or p_max is null or p_max < 1 then
    raise exception 'rate_limit_hit: key, window_seconds >= 1 and max >= 1 are required' using errcode = '22023';
  end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limit_hits as r (key, window_start, expires_at)
  values (p_key, v_start, v_start + make_interval(secs => p_window_seconds))
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  return v_hits <= p_max;
end;
$$;

-- Returns how many expired windows it deleted.
create or replace function public.rate_limit_cleanup()
returns integer
language sql volatile security definer set search_path = ''
as $$
  with gone as (delete from public.rate_limit_hits where expires_at < now() returning 1)
  select count(*)::integer from gone;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer), public.rate_limit_cleanup()
  from public, anon, authenticated, service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- cron.schedule with an existing job name updates that job, so this is idempotent
select cron.schedule('rate-limit-cleanup', '*/10 * * * *', $$ select public.rate_limit_cleanup() $$);
