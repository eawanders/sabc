-- PER-275 (Phase B3): Notion <-> Postgres sync bookkeeping. Server-only.
--
-- sync_state: one row per Notion data source the inbound sync reads.
--   cursor is the newest Notion last_edited_time already upserted; the next
--   incremental pass asks Notion for pages edited on or after it (Notion rounds
--   last_edited_time to the minute, so "on or after" re-reads that minute and
--   relies on upserts being idempotent).
--
-- notion_webhook_handshake: Notion's one-time webhook verification_token,
--   stored so Edward can read it in the Supabase dashboard and paste it back
--   into Notion (and into NOTION_WEBHOOK_VERIFICATION_TOKEN). It is a secret,
--   so it never goes to logs and the table is invisible to anon/authenticated.

create table public.sync_state (
  source      text primary key check (source in ('members', 'outings', 'events', 'swim_tests', 'marshal_slots')),
  cursor      timestamptz,
  last_run_at timestamptz,
  last_error  text
);

comment on table public.sync_state is
  'Inbound Notion sync cursors, one per data source. Written by the sync worker (service role) only.';

create table public.notion_webhook_handshake (
  id          bigserial primary key,
  received_at timestamptz not null default now(),
  token       text not null
);

comment on table public.notion_webhook_handshake is
  'Notion webhook verification tokens received by /api/sync/notion-webhook. Secret; server-only.';

alter table public.sync_state enable row level security;
alter table public.notion_webhook_handshake enable row level security;
revoke all on public.sync_state, public.notion_webhook_handshake from anon, authenticated;
revoke all on sequence public.notion_webhook_handshake_id_seq from anon, authenticated;
