-- PER-278: one Notion page per new guest name, even when two people add the
-- same guest at once.
--
-- POST /api/live/member/add looks the name up in members, then creates the
-- Notion page, then upserts members. Two simultaneous adds of a new name both
-- miss the lookup and both create a page. The route now claims the normalised
-- name here first; the claim spans the whole request (Notion call included):
--
--   claim_guest_name(name)  -> {"status": "claimed", "token": <uuid>}   go ahead and create it
--                              {"status": "exists", "member_id", "name"} someone already did
--                              {"status": "pending"}                    someone is creating it now
--                              {"status": "invalid"}                    blank name
--   finish_guest_claim(name, token, member_id)  the winner records what it created
--   release_guest_claim(name, token)            the winner gives up (e.g. Notion failed)
--
-- A claim with no member after a minute is presumed dead (the function crashed
-- or timed out) and the next claim takes it over. So is a finished claim whose
-- member no longer exists. Rows older than a day are deleted on the next claim.

create table if not exists public.guest_member_claims (
  norm_name  text primary key check (norm_name <> ''),
  token      uuid not null,
  member_id  text,
  claimed_at timestamptz not null default now()
);

comment on table public.guest_member_claims is
  'In-flight and recent guest-member adds, keyed by lower-cased normalised name (PER-278). Server only.';

alter table public.guest_member_claims enable row level security;
revoke all on public.guest_member_claims from anon, authenticated;

-- As normaliseName() in src/server/live/guestMember.ts, lower-cased
create or replace function public.guest_norm_name(p_name text) returns text
language sql immutable set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.claim_guest_name(p_name text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_norm  text := public.guest_norm_name(p_name);
  v_claim public.guest_member_claims;
  v_name  text;
begin
  if v_norm = '' then
    return '{"status": "invalid"}'::jsonb;
  end if;

  delete from public.guest_member_claims where claimed_at < now() - interval '1 day';

  insert into public.guest_member_claims (norm_name, token) values (v_norm, gen_random_uuid())
  on conflict (norm_name) do nothing
  returning * into v_claim;
  if found then
    return jsonb_build_object('status', 'claimed', 'token', v_claim.token);
  end if;

  select * into v_claim from public.guest_member_claims where norm_name = v_norm for update;

  if v_claim.member_id is not null then
    select name into v_name from public.members where id = v_claim.member_id;
    if v_name is not null then
      return jsonb_build_object('status', 'exists', 'member_id', v_claim.member_id, 'name', v_name);
    end if;
  elsif v_claim.claimed_at >= now() - interval '1 minute' then
    return '{"status": "pending"}'::jsonb;
  end if;

  -- Stale, or finished with a member that has gone: take it over
  update public.guest_member_claims
     set token = gen_random_uuid(), member_id = null, claimed_at = now()
   where norm_name = v_norm
  returning * into v_claim;
  return jsonb_build_object('status', 'claimed', 'token', v_claim.token);
end;
$$;

create or replace function public.finish_guest_claim(p_name text, p_token uuid, p_member_id text)
returns boolean
language sql volatile security definer set search_path = ''
as $$
  with done as (
    update public.guest_member_claims set member_id = p_member_id
     where norm_name = public.guest_norm_name(p_name) and token = p_token
    returning 1)
  select exists (select 1 from done);
$$;

create or replace function public.release_guest_claim(p_name text, p_token uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$
  with gone as (
    delete from public.guest_member_claims
     where norm_name = public.guest_norm_name(p_name) and token = p_token and member_id is null
    returning 1)
  select exists (select 1 from gone);
$$;

revoke all on function
  public.guest_norm_name(text),
  public.claim_guest_name(text),
  public.finish_guest_claim(text, uuid, text),
  public.release_guest_claim(text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function
  public.claim_guest_name(text),
  public.finish_guest_claim(text, uuid, text),
  public.release_guest_claim(text, uuid)
  to service_role;
