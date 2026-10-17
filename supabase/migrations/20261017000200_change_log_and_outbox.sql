-- PER-274 (Phase B2): change log ("who changed what", one-tap undo) and the
-- Notion outbox (app-owned writes mirrored out to Notion by a worker in B3).

-- ---------------------------------------------------------------- change_log
-- One row per app write. entity is the table name; entity_key holds its
-- primary key (e.g. {"outing_id": "...", "seat": "Bow"}); before/after are the
-- row images. Undo = apply `before` as a new write (itself logged) and set
-- undone_by on the original to the id of that new row.
create table public.change_log (
  id              bigserial primary key,
  at              timestamptz not null default now(),
  actor_member_id public.notion_id references public.members (id) on delete set null,
  entity          text not null,
  entity_key      jsonb not null,
  before          jsonb,
  after           jsonb,
  undone_by       bigint references public.change_log (id)
);

create index change_log_entity_idx on public.change_log (entity, entity_key, at desc);
create index change_log_actor_idx on public.change_log (actor_member_id, at desc);
create index change_log_at_idx on public.change_log (at desc);

-- ---------------------------------------------------------------- notion_outbox
-- Coalescing: one PENDING row per Notion page (entity + entity_key), enforced
-- by a partial unique index. payload is a Notion `properties` patch; a later
-- edit to the same page merges into the pending row (jsonb ||, so the latest
-- value per Notion property wins and other properties are kept). Ten people
-- reshuffling one outing therefore produce one PATCH per page per worker pass,
-- which matters against Notion's ~3 requests/second limit.
--
-- In-flight safety: every merge bumps `revision`. The worker reads (id,
-- revision, payload), sends it, then calls complete_notion_outbox(id, revision).
-- If an edit landed meanwhile the revision no longer matches, the row stays
-- pending and the merged payload is sent again on the next pass. Re-sending a
-- property is harmless because each value is the full current state, not a delta.
create table public.notion_outbox (
  id              bigserial primary key,
  entity          text not null,           -- Notion data source: 'outing', 'member', 'swim_test', 'marshal_slot'
  entity_key      jsonb not null,          -- {"page_id": "<notion page id>"}
  payload         jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  revision        integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  done_at         timestamptz,
  last_error      text
);

create unique index notion_outbox_one_pending_per_page
  on public.notion_outbox (entity, entity_key) where done_at is null;

create index notion_outbox_pending_idx
  on public.notion_outbox (next_attempt_at) where done_at is null;

create function public.enqueue_notion_outbox(p_entity text, p_entity_key jsonb, p_payload jsonb)
returns bigint
language sql
set search_path = ''
as $$
  insert into public.notion_outbox (entity, entity_key, payload)
  values (p_entity, p_entity_key, p_payload)
  on conflict (entity, entity_key) where done_at is null
  do update set payload    = public.notion_outbox.payload || excluded.payload,
                revision   = public.notion_outbox.revision + 1,
                updated_at = now()
  returning id;
$$;

comment on function public.enqueue_notion_outbox(text, jsonb, jsonb) is
  'Queue a Notion properties patch for one page, merging into that page''s pending row if there is one.';

create function public.complete_notion_outbox(p_id bigint, p_revision integer)
returns boolean
language sql
set search_path = ''
as $$
  with done as (
    update public.notion_outbox
       set done_at = now(), last_error = null
     where id = p_id and revision = p_revision and done_at is null
    returning 1
  )
  select exists (select 1 from done);
$$;

comment on function public.complete_notion_outbox(bigint, integer) is
  'Mark an outbox row sent. Returns false (and leaves it pending) if it was edited after the worker read it.';
