// src/server/notion/marshals.ts

import { cache } from 'react';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type {
  ClashCrew,
  MarshalDay,
  MarshalEvent,
  MarshalLocation,
  MarshalPersonStatus,
  MarshalRole,
  MarshalShift,
  MarshalSlot,
} from '@/types/marshal';
import type { Member } from '@/types/members';
import { queryDataSource } from './query';
import { getMembers } from './members';

const DEFAULT_MARSHALS_DB_ID = 'a7d958881fd84cbe92c80f3d659391fd';

function resolveMarshalsDatabaseId() {
  const explicit = process.env.NOTION_MARSHALS_DB_ID;
  if (explicit && explicit.trim().length > 0) return explicit.trim();
  return DEFAULT_MARSHALS_DB_ID;
}

async function fetchMarshalsInternal(): Promise<MarshalSlot[]> {
  const databaseId = resolveMarshalsDatabaseId();
  const pages = await queryDataSource<PageObjectResponse>(
    databaseId,
    {
      sorts: [{ property: 'Slot Time', direction: 'ascending' }],
    },
    'marshals.query'
  );
  const members = await getMembers();
  const memberMap = new Map(members.map((m) => [m.id, m] as const));
  return pages
    .map((page) => mapMarshal(page, memberMap))
    .filter((s): s is MarshalSlot => Boolean(s));
}

export const getMarshals = cache(fetchMarshalsInternal);

function mapMarshal(
  page: PageObjectResponse,
  memberMap: Map<string, Member>
): MarshalSlot | null {
  const props = page.properties as Record<string, any>;
  const name = extractPlainText(props['Name']);
  const date = props['Slot Time']?.date;
  if (!name || !date?.start) return null;

  const persons = mapRelationMembers(props['Person'], memberMap);

  return {
    id: page.id,
    url: page.url,
    name,
    slotId: props['Slot ID']?.unique_id?.number ?? undefined,
    event: props['Event']?.select?.name as MarshalEvent | undefined,
    day: props['Day']?.select?.name as MarshalDay | undefined,
    role: props['Role']?.select?.name as MarshalRole | undefined,
    shift: props['Shift']?.select?.name as MarshalShift | undefined,
    location: props['Location']?.select?.name as MarshalLocation | undefined,
    startTime: date.start,
    endTime: date.end || undefined,
    isDatetime: date.start.includes('T'),
    person: persons[0],
    personStatus:
      (props['Person Status']?.select?.name as MarshalPersonStatus | undefined) ?? 'Open',
    clashCrews: ((props['Clash Crews']?.multi_select ?? []) as { name: string }[])
      .map((s) => s.name as ClashCrew)
      .filter(Boolean),
    notes: extractPlainText(props['Notes']),
    publish: Boolean(props['Publish']?.checkbox),
  };
}

function mapRelationMembers(property: any, memberMap: Map<string, Member>): Member[] {
  if (!property?.relation) return [];
  return property.relation
    .map(({ id }: { id: string }) => memberMap.get(id))
    .filter((m: Member | undefined): m is Member => Boolean(m));
}

function extractPlainText(property: any): string | undefined {
  if (!property) return undefined;
  if (Array.isArray(property.title)) {
    return (
      property.title
        .map((item: { plain_text?: string }) => item.plain_text ?? '')
        .join('')
        .trim() || undefined
    );
  }
  if (Array.isArray(property.rich_text)) {
    return (
      property.rich_text
        .map((item: { plain_text?: string }) => item.plain_text ?? '')
        .join('')
        .trim() || undefined
    );
  }
  if (typeof property === 'string') return property.trim();
  return undefined;
}
