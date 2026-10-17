# Supabase: the live data model

Postgres (Supabase, with Realtime) is the app's live store. Notion stays the
editing surface for the things the club manages there; the app owns everything
members change from their phones.

## Running locally

Needs Docker and the Supabase CLI (`brew install supabase/tap/supabase`).

```sh
supabase start                         # first run pulls images
supabase db reset                      # apply migrations + seed.sql from scratch
supabase test db                       # pgTAP tests in supabase/tests/
supabase stop                          # free the containers
```

The local stack uses ports 553xx (API on 55321, Postgres on 55322, Studio on
55323) so it can run alongside other projects' Supabase stacks on the default
543xx ports. `supabase start` prints local keys; they are the CLI's fixed
development keys, so don't put them anywhere else and don't commit `.env*`.

`seed.sql` is a small made-up club. It must never contain real member data.

## Applying migrations to the remote project

- `.github/workflows/supabase-migrate.yml` runs on push to `main` when
  `supabase/migrations/**` changes: `supabase link`, then `supabase db push`.
  It needs the repository secrets `SUPABASE_ACCESS_TOKEN` (Side Projects org)
  and `SUPABASE_DB_PASSWORD`. It can also be run by hand from the Actions tab.
- `.github/workflows/db-tests.yml` runs `supabase test db` on every PR that
  touches `supabase/**`.
- `db push` refuses a migration older than the newest one already applied, so
  name new files with a timestamp later than every existing migration.
- Migrations are forward-only; a mistake is fixed by a new migration.
- The first four migrations were applied through the Supabase MCP on 17 Oct
  and their history rows were renamed to match these filenames.

## Who owns what

| Data | Owner | Table(s) | Direction |
| --- | --- | --- | --- |
| Outing details: name, type, division, shell, start/end, status (Confirmed / Provisional / Cancelled), Publish, details | Notion | `outings` | Synced in (B3) |
| Members (name, member types, cox experience) | Notion | `members` | Synced in (B3) |
| Events | Notion | `events` | Synced in (B3) |
| Swim-test and marshal slot definitions | Notion | `swim_tests`, definition columns of `marshal_slots` | Synced in (B3) |
| Seats and seat statuses | App | `outing_seats` | Mirrored out via `notion_outbox` (B3) |
| Outing reports | App | `outing_reports` | Mirrored out |
| Weekly unavailability | App | `member_unavailability` | Mirrored out |
| Swim-test bookings and outcomes | App | `swim_test_slots` | Mirrored out |
| Marshal sign-ups | App | `marshal_slots.person_id`, `person_status` | Mirrored out |

Ids are Notion page ids in lower-case hyphenated form (the `notion_id` domain
enforces it). Synced tables carry `notion_last_edited_at` and `synced_at`.

## Access

- The browser uses the anon key for reads and Realtime only. `anon` and
  `authenticated` have `SELECT` on every member-facing table and no write
  privileges at all; `notion_outbox` is invisible to them.
- All writes go through server routes using the service role. The actor is a
  member id ("pick your name once"); there are no auth users.
- Unpublished outings and marshal slots (and the seats and reports of
  unpublished outings) are hidden from anon/authenticated.
- `members` holds no emails, phone numbers or dates of birth, by design.

## Conflicts, history and the outbox

- **Versions.** Every app-owned row has `version`, `updated_by`, `updated_at`.
  A trigger bumps `version` on each update, so a claim is
  `update ... where <key> and version = <seen>`: the first claim wins, and the
  loser re-reads the row to see who took it (`updated_by`). On `marshal_slots`
  only changes to `person_id` / `person_status` bump the version, so a Notion
  sync of the slot's definition doesn't break a sign-up in flight.
- **Pre-created rows.** Inserting an outing creates its 14 seat rows;
  inserting a swim test creates its 6 slot rows. Every claim is an UPDATE, and
  Realtime subscribers see one kind of event.
- **change_log.** One row per app write: actor, entity (table name), entity
  key (the row's primary key as JSON), before and after images. Undo writes
  `before` back as a new, logged change and sets `undone_by` on the original.
- **notion_outbox coalescing.** At most one pending row per Notion page
  (partial unique index on `entity, entity_key` where `done_at is null`).
  `enqueue_notion_outbox(entity, key, payload)` merges a Notion `properties`
  patch into the pending row (latest value per property wins) and bumps
  `revision`. The worker sends a row, then calls
  `complete_notion_outbox(id, revision)`; if someone edited the page in the
  meantime the revision no longer matches and the row stays pending for the
  next pass.

## Notion sync (B3)

Code: `src/server/sync/`. Entry points: `POST /api/sync/run` (the per-minute
tick) and `POST /api/sync/notion-webhook`. Bookkeeping: `sync_state` (one
cursor per data source) and `notion_webhook_handshake`, both server-only.

**Inbound (Notion → Postgres)**, members → outings → events → swim_tests →
marshal_slots. Each source asks Notion for pages with `last_edited_time` on or
after its cursor (oldest first), upserts them by id and moves the cursor to the
newest edit it upserted. Notion rounds `last_edited_time` to the minute, so the
cursor minute is re-read every pass; upserts are idempotent so that is harmless.
Only Notion-owned columns are ever sent (`src/server/sync/sources.ts`), and
PostgREST's upsert updates only the columns it is given, so seats, slot
bookings, marshal sign-ups, reports and unavailability are never touched.

- Date-only Notion values are stored as midnight Europe/London with
  `all_day = true` (outings have no `all_day` column; their date-only starts
  are just midnight).
- `Member Type` (multi_select) → `members.member_type text[]`.
- The live Outings property is **Details**, not "Session Details" (checked
  2026-10-17); the sync reads Details and falls back to Session Details.
  Outings has no Term or Week property, so those columns stay null.
- Values that would break a CHECK (an unknown outing status, Available Slots
  outside 0–6) are stored as null / clamped rather than failing the batch.

**Deletions (soft approach).** Only rows of Notion-owned tables are deleted, and
only when Notion says so: a page returned as `archived`/`in_trash`, a
`page.deleted` webhook (the page is re-read first; `page.undeleted` restores
it), or a full sweep (`/api/sync/run?full=1`) that no longer sees the page.
A full sweep never deletes from an empty result. Note the cascades: deleting an
outing deletes its seats and report; deleting a member clears their seats and
sign-ups (`on delete set null`).

**Outbound (Postgres → Notion).** `runOutbox` sends due `notion_outbox` rows
(`next_attempt_at <= now`, oldest first) as `PATCH /v1/pages/{page_id}` with the
row's `payload` as `properties`, then calls `complete_notion_outbox(id,
revision)`. A revision mismatch leaves the row pending and it is sent again with
the merged payload. Errors: `attempts + 1`, `last_error`, and `next_attempt_at`
= now + 10 s × 2^(attempts−1) (capped at 1 h, jittered to 50–100%). A 429 uses
Notion's `retry-after` (+ up to 1 s jitter) and ends the run. All Notion calls
in one server instance share a pacer: at most 2.5 requests/second.

**Budget.** `/api/sync/run` gives inbound 25 s and stops starting new outbox
rows at 50 s (function `maxDuration` 60 s). Inbound saves its cursor after
every page of results, so a run cut short resumes where it stopped.

**Webhook.** Notion integration webhooks
(<https://developers.notion.com/reference/webhooks>). Setup, once:

1. Deploy with `NOTION_WEBHOOK_VERIFICATION_TOKEN` **unset**.
2. In the Notion integration settings → Webhooks, add
   `https://<app>/api/sync/notion-webhook` and subscribe to page events.
3. Notion POSTs a `verification_token`; the route stores it in
   `notion_webhook_handshake` (never logged). Read it in the Supabase table
   editor, paste it into Notion's Verify dialog, and set it as
   `NOTION_WEBHOOK_VERIFICATION_TOKEN`. Redeploy. Further handshakes are ignored.

Every event must carry `X-Notion-Signature: sha256=<HMAC-SHA256(raw body,
token)>`. Page changes trigger an incremental sync of their data source after
the response (`after()`), debounced to once per 15 s per source; the
per-minute tick catches anything debounced.

**Environment** (server only; never `NEXT_PUBLIC_`):

| Variable | Used by |
| --- | --- |
| `SUPABASE_URL` | sync worker, backfill |
| `SUPABASE_SERVICE_ROLE_KEY` | sync worker, backfill (bypasses RLS) |
| `NOTION_TOKEN` | existing; the integration needs read + update content on the five databases |
| `NOTION_WEBHOOK_VERIFICATION_TOKEN` | webhook signature check |
| `SYNC_SHARED_SECRET` | `x-sync-secret` header on `/api/sync/run` |

### Proposed scheduler (not applied)

Supabase `pg_cron` + `pg_net` (both on the free tier) call the tick every
minute. It needs the shared secret, so it lives here rather than in a
migration; keep the secret in Vault, not in the job text:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<SYNC_SHARED_SECRET>', 'sync_shared_secret');

select cron.schedule('notion-sync', '* * * * *', $$
  select net.http_post(
    url     := 'https://<app>/api/sync/run',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_shared_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000);
$$);

-- Nightly full sweep (also infers deletions):
select cron.schedule('notion-sync-full', '17 3 * * *', $$
  select net.http_post(
    url     := 'https://<app>/api/sync/run?full=1',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_shared_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000);
$$);
```

### One-off backfill of app-owned data

Copies today's seats + statuses, outing reports, weekly unavailability,
swim-test slot bookings + outcomes and marshal sign-ups from Notion into
Postgres. It reads Notion only, never runs automatically, writes only rows that
differ (a second run writes nothing) and leaves rows the app has already changed
(`version > 0`) alone unless `--overwrite`:

```sh
# .env.local with NOTION_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npx -y tsx --env-file=.env.local scripts/sync-backfill.ts --dry-run   # full inbound sync + counts
npx -y tsx --env-file=.env.local scripts/sync-backfill.ts             # write
```

Relations to members Postgres does not have (nameless form submissions) are
dropped and counted as `unknownRefs`; only the first member of a relation is
used.

### Tests

- Unit (CI): `npx vitest run src/server/sync src/app/api/sync`.
- pgTAP: `supabase test db` (includes `04_sync_state.test.sql`).
- Integration against the local stack (not CI): see the header of
  `src/server/sync/integration.test.ts`.

### Known risks

- The pacer is per server instance. Two instances (a webhook burst during the
  minute tick) can briefly exceed 2.5 req/s together; the 429 path absorbs it.
- No lease on the outbox: two overlapping ticks could send the same row twice.
  That is harmless (payloads are full current values) and the 50 s budget keeps
  ticks from overlapping.
- A row that fails permanently (e.g. a 400 for a renamed Notion property) keeps
  retrying hourly with `last_error` set; nothing alerts on it yet.
- Notion "Files & media" URLs for uploaded files expire after about an hour, so
  `events.files` goes stale between edits; re-hosting the images is still open.
