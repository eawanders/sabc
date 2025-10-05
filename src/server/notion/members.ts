import { cache } from 'react';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type { Member } from '@/types/members';
import { getEnvVar } from './env';
import { queryDataSource } from './query';

function mapMember(page: PageObjectResponse): Member | null {
  const properties = page.properties as Record<string, any>;

  const fullName = extractText(properties['Full Name']);
  if (!fullName) {
    return null;
  }

  const email = properties['Email Address']?.email ?? extractText(properties['Email Address']);
  const memberType = properties['Member Type']?.select?.name ?? extractText(properties['Member Type']);
  const coxExperience = properties['Cox Experience']?.select?.name ?? extractText(properties['Cox Experience']) ?? undefined;

  return {
    id: page.id,
    name: fullName,
    email: email ?? '',
    memberType: memberType ?? '',
    coxExperience,
  };
}

function extractText(property: any): string | undefined {
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

async function fetchMembers() {
  const databaseId = getEnvVar('NOTION_MEMBERS_DB_ID');
  const pages = await queryDataSource<PageObjectResponse>(
    databaseId,
    {},
    'members.query',
  );

  return pages
    .map((page) => mapMember(page))
    .filter((member): member is Member => Boolean(member));
}

export const getMembers = cache(fetchMembers);
