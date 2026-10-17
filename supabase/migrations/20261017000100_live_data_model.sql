-- PER-274 (Phase B2): live data model.
--
-- Postgres becomes the live store; Notion stays the editing surface for what it owns.
--   Synced IN from Notion (B3), keyed by Notion page id: members, outings (details),
--     events, swim_tests (definitions), marshal_slots (definition columns).
--   Owned by the app, mirrored OUT to Notion through notion_outbox (B3):
--     outing_seats, outing_reports, member_unavailability, swim_test_slots,
--     marshal_slots (person_id / person_status).
--
-- Ids are Notion page ids in canonical lower-case hyphenated form.

create domain public.notion_id as text
  check (value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

comment on domain public.notion_id is
  'A Notion page id, lower-case and hyphenated (e.g. 1f2e3d4c-0000-4000-8000-000000000001).';

-- Every write to an app-owned row bumps version and stamps updated_at, so
-- B4's RPCs can claim with "... where version = <the version the client saw>"
-- and the loser learns who won from updated_by.
create function public.bump_version() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- members
create table public.members (
  id                    public.notion_id primary key,
  name                  text not null,
  member_type           text,
  cox_experience        text,
  notion_last_edited_at timestamptz,
  synced_at             timestamptz not null default now()
);

comment on table public.members is
  'Synced from the Notion Members data source. Deliberately holds no contact or personal data.';

-- ---------------------------------------------------------------- outings
create table public.outings (
  id                    public.notion_id primary key,
  outing_no             integer,            -- Notion "Outing ID" (unique_id number)
  name                  text not null default '',
  type                  text check (type in ('Water Outing', 'Erg Session', 'Tank Session', 'Gym Session', 'Race')),
  div                   text,
  shell                 text,
  term                  text,
  week                  text,
  start_at              timestamptz,
  end_at                timestamptz,
  status                text check (status in ('Confirmed', 'Provisional', 'Cancelled')),
  publish               boolean not null default false,
  details               text,               -- Notion "Session Details"
  notion_last_edited_at timestamptz,
  synced_at             timestamptz not null default now()
);

create index outings_start_at_idx on public.outings (start_at);

comment on table public.outings is 'Outing details, synced from Notion. Seats live in outing_seats.';

-- ---------------------------------------------------------------- outing_seats
create table public.outing_seats (
  outing_id  public.notion_id not null references public.outings (id) on delete cascade,
  -- Notion relation property names (the drawer's 'Sub1' maps to 'Sub 1')
  seat       text not null check (seat in (
               'Cox', 'Stroke', '7 Seat', '6 Seat', '5 Seat', '4 Seat', '3 Seat', '2 Seat', 'Bow',
               'Sub 1', 'Sub 2', 'Sub 3', 'Sub 4', 'Coach/Bank Rider')),
  member_id  public.notion_id references public.members (id) on delete set null,
  status     text check (status in ('Reserved', 'Not Available', 'Awaiting Approval', 'Maybe Available', 'Available')),
  version    integer not null default 0,
  updated_by public.notion_id references public.members (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (outing_id, seat)
);

create index outing_seats_member_idx on public.outing_seats (member_id) where member_id is not null;

create trigger outing_seats_bump_version before update on public.outing_seats
  for each row execute function public.bump_version();

comment on table public.outing_seats is
  'App-owned. One row per seat per outing, created with the outing, so a claim is a conditional UPDATE.';

-- Every outing has all 14 seat rows from the start.
create function public.create_outing_seats() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.outing_seats (outing_id, seat)
  select new.id, s
    from unnest(array['Cox', 'Stroke', '7 Seat', '6 Seat', '5 Seat', '4 Seat', '3 Seat', '2 Seat', 'Bow',
                      'Sub 1', 'Sub 2', 'Sub 3', 'Sub 4', 'Coach/Bank Rider']) as s
  on conflict do nothing;
  return new;
end;
$$;

create trigger outings_create_seats after insert on public.outings
  for each row execute function public.create_outing_seats();

-- ---------------------------------------------------------------- outing_reports
create table public.outing_reports (
  outing_id        public.notion_id primary key references public.outings (id) on delete cascade,
  outing_summary   text,
  boat_feel        text,
  outing_successes text,
  next_focus       text,
  coach_feedback   text,
  version          integer not null default 0,
  updated_by       public.notion_id references public.members (id) on delete set null,
  updated_at       timestamptz not null default now()
);

create trigger outing_reports_bump_version before update on public.outing_reports
  for each row execute function public.bump_version();

-- ---------------------------------------------------------------- member_unavailability
-- One jsonb array of {start, end} "HH:MM" ranges per weekday, mirroring the
-- seven "Unavailable <Day>" Notion text fields. Range validation (max 3, no
-- overlap) stays in the app (validateWeeklyAvailability).
create table public.member_unavailability (
  member_id  public.notion_id primary key references public.members (id) on delete cascade,
  monday     jsonb not null default '[]' check (jsonb_typeof(monday) = 'array'),
  tuesday    jsonb not null default '[]' check (jsonb_typeof(tuesday) = 'array'),
  wednesday  jsonb not null default '[]' check (jsonb_typeof(wednesday) = 'array'),
  thursday   jsonb not null default '[]' check (jsonb_typeof(thursday) = 'array'),
  friday     jsonb not null default '[]' check (jsonb_typeof(friday) = 'array'),
  saturday   jsonb not null default '[]' check (jsonb_typeof(saturday) = 'array'),
  sunday     jsonb not null default '[]' check (jsonb_typeof(sunday) = 'array'),
  version    integer not null default 0,
  updated_by public.notion_id references public.members (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger member_unavailability_bump_version before update on public.member_unavailability
  for each row execute function public.bump_version();

-- ---------------------------------------------------------------- events
create table public.events (
  id                    public.notion_id primary key,
  title                 text not null,
  description           text,
  start_at              timestamptz,
  end_at                timestamptz,
  all_day               boolean not null default false,
  embedded_form         text,
  files                 jsonb not null default '[]',   -- Notion "Files & media" as returned
  notion_last_edited_at timestamptz,
  synced_at             timestamptz not null default now()
);

create index events_start_at_idx on public.events (start_at);

-- ---------------------------------------------------------------- swim_tests
create table public.swim_tests (
  id                    public.notion_id primary key,
  title                 text not null,                 -- Notion "OURC Test"
  type                  text check (type in ('Swim Test', 'Capsize Drill')),
  available_slots       smallint not null default 0 check (available_slots between 0 and 6),
  start_at              timestamptz,
  end_at                timestamptz,
  all_day               boolean not null default false,
  notion_last_edited_at timestamptz,
  synced_at             timestamptz not null default now()
);

create index swim_tests_start_at_idx on public.swim_tests (start_at);

create table public.swim_test_slots (
  test_id    public.notion_id not null references public.swim_tests (id) on delete cascade,
  slot       smallint not null check (slot between 1 and 6),
  member_id  public.notion_id references public.members (id) on delete set null,
  outcome    text check (outcome in ('No Show', 'Test Booked', 'Failed', 'Passed')),
  version    integer not null default 0,
  updated_by public.notion_id references public.members (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (test_id, slot)
);

create index swim_test_slots_member_idx on public.swim_test_slots (member_id) where member_id is not null;

create trigger swim_test_slots_bump_version before update on public.swim_test_slots
  for each row execute function public.bump_version();

create function public.create_swim_test_slots() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.swim_test_slots (test_id, slot)
  select new.id, s from generate_series(1, 6) as s
  on conflict do nothing;
  return new;
end;
$$;

create trigger swim_tests_create_slots after insert on public.swim_tests
  for each row execute function public.create_swim_test_slots();

-- ---------------------------------------------------------------- marshal_slots
-- Definition columns are synced from Notion; person_id / person_status are app-owned.
-- event/day/shift/role/location are Notion selects whose options change each
-- regatta, so they are not CHECKed here.
create table public.marshal_slots (
  id                    public.notion_id primary key,
  name                  text not null,
  slot_no               integer,             -- Notion "Slot ID" (unique_id number)
  event                 text,
  day                   text,
  shift                 text,
  role                  text,
  location              text,
  start_at              timestamptz,         -- Notion "Slot Time"
  end_at                timestamptz,
  all_day               boolean not null default false,
  notes                 text,
  publish               boolean not null default false,
  clash_crews           text[] not null default '{}',
  notion_last_edited_at timestamptz,
  synced_at             timestamptz not null default now(),
  person_id             public.notion_id references public.members (id) on delete set null,
  person_status         text not null default 'Open' check (person_status in (
                          'Open', 'Reserved', 'Maybe Available', 'Awaiting Approval', 'Confirmed', 'Not Available')),
  version               integer not null default 0,
  updated_by            public.notion_id references public.members (id) on delete set null,
  updated_at            timestamptz not null default now()
);

create index marshal_slots_person_idx on public.marshal_slots (person_id) where person_id is not null;
create index marshal_slots_start_at_idx on public.marshal_slots (start_at);

-- Only the app-owned columns move version, so a Notion sync of the slot's
-- definition does not invalidate a sign-up in flight.
create trigger marshal_slots_bump_version before update on public.marshal_slots
  for each row
  when (old.person_id is distinct from new.person_id or old.person_status is distinct from new.person_status)
  execute function public.bump_version();
