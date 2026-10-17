import { unstable_cache } from 'next/cache';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { RowerWeeklyAvailability, parseTimeRanges } from '@/types/rowerAvailability';
import { getEnvVar } from './env';
import { queryDataSource } from './query';

export const ROWER_AVAILABILITY_TAG = 'rower-availability';

export function mapRowerAvailability(page: PageObjectResponse): RowerWeeklyAvailability {
  const properties = page.properties as Record<string, any>

  // Extract member name
  const fullName = extractText(properties['Full Name']) || 'Unknown'

  // Map day properties to availability
  const availability: RowerWeeklyAvailability = {
    memberId: page.id,
    memberName: fullName,
    monday: parseTimeRanges(extractText(properties['Unavailable Monday'])),
    tuesday: parseTimeRanges(extractText(properties['Unavailable Tuesday'])),
    wednesday: parseTimeRanges(extractText(properties['Unavailable Wednesday'])),
    thursday: parseTimeRanges(extractText(properties['Unavailable Thursday'])),
    friday: parseTimeRanges(extractText(properties['Unavailable Friday'])),
    saturday: parseTimeRanges(extractText(properties['Unavailable Saturday'])),
    sunday: parseTimeRanges(extractText(properties['Unavailable Sunday']))
  }

  return availability
}

function extractText(property: any): string | undefined {
  if (!property) return undefined

  if (Array.isArray(property.title)) {
    return property.title.map((item: { plain_text?: string }) => item.plain_text ?? '').join('').trim() || undefined
  }

  if (Array.isArray(property.rich_text)) {
    return property.rich_text.map((item: { plain_text?: string }) => item.plain_text ?? '').join('').trim() || undefined
  }

  if (typeof property === 'string') {
    return property.trim()
  }

  return undefined
}

/**
 * Every member's weekly unavailability from one members query (2 Notion calls
 * for ~100 members) instead of one page fetch per member. Throws on failure so
 * the cache below never stores an empty result.
 */
export async function fetchAllRowerAvailability(): Promise<RowerWeeklyAvailability[]> {
  const databaseId = getEnvVar('NOTION_MEMBERS_DB_ID');
  const pages = await queryDataSource<PageObjectResponse>(
    databaseId,
    {},
    'rower-availability.all',
  );

  return pages.map((page) => mapRowerAvailability(page));
}

export const getAllRowerAvailability = unstable_cache(
  fetchAllRowerAvailability,
  ['all-rower-availability'],
  { revalidate: 60, tags: [ROWER_AVAILABILITY_TAG] },
);
