// The five Notion data sources the inbound sync reads, in dependency order, and
// how each page maps onto the Notion-OWNED columns of its table. App-owned
// columns (seats, slot bookings, marshal sign-ups, reports, unavailability)
// never appear here, so an inbound upsert cannot overwrite them.
import {
  checkbox,
  dateRange,
  numberValue,
  optionName,
  optionNames,
  plainText,
  uniqueIdNumber,
} from './notionValues';

export type SourceKey = 'members' | 'outings' | 'events' | 'swim_tests' | 'marshal_slots';
export type Row = Record<string, unknown>;

export interface NotionPage {
  id: string;
  last_edited_time?: string;
  archived?: boolean;
  in_trash?: boolean;
  properties?: Record<string, unknown>;
}

export interface SourceDef {
  key: SourceKey;
  table: SourceKey;
  /** Notion database id (hyphenated) and its data source id (API 2025-09-03). */
  databaseId: string;
  dataSourceId: string;
  /** Maps a page to its row of Notion-owned columns, or null to skip the page. */
  map: (page: NotionPage) => Row | null;
}

const OUTING_STATUSES = new Set(['Confirmed', 'Provisional', 'Cancelled']);

/** Lower-case hyphenated page id, the form the notion_id domain enforces. */
export function canonicalId(id: string): string {
  const hex = id.replace(/-/g, '').toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isTrashed(page: NotionPage): boolean {
  return page.archived === true || page.in_trash === true;
}

function syncedColumns(page: NotionPage) {
  return {
    id: canonicalId(page.id),
    notion_last_edited_at: page.last_edited_time ?? null,
    synced_at: new Date().toISOString(),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const props = (page: NotionPage) => (page.properties ?? {}) as Record<string, any>;

export function mapMember(page: NotionPage): Row | null {
  const p = props(page);
  const name = plainText(p['Full Name']);
  if (!name) return null; // nameless form submissions; the app never listed them
  return {
    ...syncedColumns(page),
    name,
    member_type: optionNames(p['Member Type']),
    cox_experience: optionName(p['Cox Experience']),
  };
}

export function mapOuting(page: NotionPage): Row {
  const p = props(page);
  const start = dateRange(p['Start Date/Time']);
  const end = dateRange(p['End Date/Time']);
  const status = optionName(p['Status']);
  return {
    ...syncedColumns(page),
    outing_no: uniqueIdNumber(p['Outing ID']),
    name: plainText(p['Name']) ?? '',
    type: optionName(p['Type']),
    div: optionName(p['Div']),
    shell: optionName(p['Shell']),
    // Term and Week are not properties of the live Outings data source (checked
    // 2026-10-17); read them if they are ever added.
    term: optionName(p['Term']),
    week: optionName(p['Week']),
    start_at: start.start_at,
    end_at: end.start_at ?? start.end_at,
    status: status && OUTING_STATUSES.has(status) ? status : null,
    publish: checkbox(p['Publish Outing']),
    // The live property is "Details"; older code read "Session Details".
    details: plainText(p['Details']) ?? plainText(p['Session Details']),
  };
}

export function mapEvent(page: NotionPage): Row {
  const p = props(page);
  const files = Array.isArray(p['Files & media']?.files) ? p['Files & media'].files : [];
  return {
    ...syncedColumns(page),
    title: plainText(p['Event']) ?? 'Untitled Event',
    description: plainText(p['Description']),
    ...dateRange(p['Date']),
    embedded_form: plainText(p['Embedded Form']),
    files,
  };
}

export function mapSwimTest(page: NotionPage): Row {
  const p = props(page);
  const slots = numberValue(p['Available Slots']) ?? 0;
  return {
    ...syncedColumns(page),
    title: plainText(p['OURC Test']) ?? '',
    type: optionName(p['Type']),
    available_slots: Math.max(0, Math.min(6, Math.trunc(slots))),
    ...dateRange(p['Date']),
  };
}

/** Definition columns only: person_id / person_status are app-owned. */
export function mapMarshalSlot(page: NotionPage): Row {
  const p = props(page);
  return {
    ...syncedColumns(page),
    name: plainText(p['Name']) ?? '',
    slot_no: uniqueIdNumber(p['Slot ID']),
    event: optionName(p['Event']),
    day: optionName(p['Day']),
    shift: optionName(p['Shift']),
    role: optionName(p['Role']),
    location: optionName(p['Location']),
    ...dateRange(p['Slot Time']),
    notes: plainText(p['Notes']),
    publish: checkbox(p['Publish']),
    clash_crews: optionNames(p['Clash Crews']),
  };
}

// Data source ids match src/server/notion/datasource.ts.
export const SOURCES: SourceDef[] = [
  {
    key: 'members',
    table: 'members',
    databaseId: '23d80040-a8fa-80c0-8319-d48a416d0d3b',
    dataSourceId: '23d80040-a8fa-80cc-8b43-000ba4901edf',
    map: mapMember,
  },
  {
    key: 'outings',
    table: 'outings',
    databaseId: '23d80040-a8fa-80ed-afaf-f6c83477d5d0',
    dataSourceId: '23d80040-a8fa-80e1-a538-000bc51d1f0d',
    map: mapOuting,
  },
  {
    key: 'events',
    table: 'events',
    databaseId: '27a80040-a8fa-804a-9f8b-d536dcc548a7',
    dataSourceId: '27a80040-a8fa-80ee-b4d6-000b500d815b',
    map: mapEvent,
  },
  {
    key: 'swim_tests',
    table: 'swim_tests',
    databaseId: '27980040-a8fa-8050-a61c-e835396544f4',
    dataSourceId: '27980040-a8fa-80a1-b1b5-000b57b26287',
    map: mapSwimTest,
  },
  {
    key: 'marshal_slots',
    table: 'marshal_slots',
    databaseId: 'a7d95888-1fd8-4cbe-92c8-0f3d659391fd',
    dataSourceId: '930f9a4b-c9d9-498a-be7b-f88e7ae85931',
    map: mapMarshalSlot,
  },
];

export function sourceByKey(key: SourceKey): SourceDef {
  return SOURCES.find((s) => s.key === key)!;
}

/** Finds the source for a Notion parent id (database id or data source id, any format). */
export function sourceForParent(...ids: (string | undefined | null)[]): SourceDef | undefined {
  const wanted = ids.filter((id): id is string => Boolean(id)).map(canonicalId);
  return SOURCES.find((s) => wanted.includes(s.databaseId) || wanted.includes(s.dataSourceId));
}
