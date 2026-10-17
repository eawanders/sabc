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

Not set up yet. Proposal:

- A GitHub Actions job runs on push to `main` when `supabase/migrations/**`
  changes: `supabase link --project-ref <ref>` then `supabase db push`.
- Secrets: `SUPABASE_ACCESS_TOKEN` (a personal or org access token) and
  `SUPABASE_DB_PASSWORD`. The project ref is not secret and can live in the
  workflow.
- PRs that add migrations should keep running `supabase db reset && supabase
  test db` locally (a CI job for the pgTAP tests can follow later).
- Migrations are forward-only; a mistake is fixed by a new migration.

## Who owns what

| Data | Owner | Table(s) | Direction |
| --- | --- | --- | --- |
| Outing details: name, type, division, shell, start/end, status (Confirmed / Provisional / Cancelled), Publish, details | Notion | `outings` | Synced in (B3) |
| Members (name, member type, cox experience) | Notion | `members` | Synced in (B3) |
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
