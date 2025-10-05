import { cache } from 'react';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type { Member } from '@/types/members';
import type { Test, TestOutcome, TestType } from '@/types/test';
import { queryDataSource } from './query';
import { getMembers } from './members';

const DEFAULT_TESTS_DB_ID = '27980040a8fa8050a61ce835396544f4';
const SLOT_FIELDS = ['Slot 1', 'Slot 2', 'Slot 3', 'Slot 4', 'Slot 5', 'Slot 6'] as const;
const SLOT_OUTCOME_FIELDS = ['Slot 1 Outcome', 'Slot 2 Outcome', 'Slot 3 Outcome', 'Slot 4 Outcome', 'Slot 5 Outcome', 'Slot 6 Outcome'] as const;

function resolveTestsDatabaseId() {
  const explicit = process.env.NOTION_TESTS_DB_ID;
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }
  return DEFAULT_TESTS_DB_ID;
}

async function fetchTestsInternal(): Promise<Test[]> {
  const databaseId = resolveTestsDatabaseId();
  const pages = await queryDataSource<PageObjectResponse>(
    databaseId,
    {
      sorts: [
        {
          property: 'Date',
          direction: 'ascending',
        },
      ],
    },
    'tests.query'
  );

  const members = await getMembers();
  const memberMap = new Map(members.map((member) => [member.id, member] as const));

  return pages.map((page) => mapTest(page, memberMap)).filter((test): test is Test => Boolean(test));
}

export const getTests = cache(fetchTestsInternal);

function mapTest(page: PageObjectResponse, memberMap: Map<string, Member>): Test | null {
  const properties = page.properties as Record<string, any>;
  const title = extractPlainText(properties['OURC Test']);
  const type = properties['Type']?.select?.name as TestType | undefined;
  const availableSlots = properties['Available Slots']?.number ?? 0;
  const dateInfo = properties['Date']?.date;

  if (!title || !type || !dateInfo?.start) {
    return null;
  }

  const slotMembers = SLOT_FIELDS.map((slot) => mapRelationMembers(properties[slot], memberMap));
  const slotOutcomes = SLOT_OUTCOME_FIELDS.map((field) => properties[field]?.status?.name as TestOutcome | undefined);

  const start = dateInfo.start;
  const end = dateInfo.end || undefined;

  return {
    id: page.id,
    url: page.url,
    title,
    type,
    availableSlots,
    date: {
      start,
      end,
      isDatetime: start.includes('T'),
    },
    slot1: slotMembers[0],
    slot2: slotMembers[1],
    slot3: slotMembers[2],
    slot4: slotMembers[3],
    slot5: slotMembers[4],
    slot6: slotMembers[5],
    slot1Outcome: slotOutcomes[0],
    slot2Outcome: slotOutcomes[1],
    slot3Outcome: slotOutcomes[2],
    slot4Outcome: slotOutcomes[3],
    slot5Outcome: slotOutcomes[4],
    slot6Outcome: slotOutcomes[5],
  };
}

function mapRelationMembers(property: any, memberMap: Map<string, Member>): Member[] {
  if (!property?.relation) return [];
  return property.relation
    .map(({ id }: { id: string }) => memberMap.get(id))
    .filter((member): member is Member => Boolean(member));
}

function extractPlainText(property: any): string | undefined {
  if (!property) return undefined;
  if (Array.isArray(property.title)) {
    return property.title.map((item: { plain_text?: string }) => item.plain_text ?? '').join('').trim() || undefined;
  }
  if (Array.isArray(property.rich_text)) {
    return property.rich_text.map((item: { plain_text?: string }) => item.plain_text ?? '').join('').trim() || undefined;
  }
  if (typeof property === 'string') {
    return property.trim();
  }
  return undefined;
}
