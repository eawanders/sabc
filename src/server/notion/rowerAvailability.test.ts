import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryDataSource, notionRequest } = vi.hoisted(() => ({ queryDataSource: vi.fn(), notionRequest: vi.fn() }));
vi.mock('./query', () => ({ queryDataSource }));
vi.mock('./client', () => ({ notionRequest }));
vi.mock('next/cache', () => ({ unstable_cache: vi.fn((fn: unknown) => fn) }));

import { unstable_cache } from 'next/cache';
import {
  ROWER_AVAILABILITY_TAG,
  fetchAllRowerAvailability,
} from './rowerAvailability';

function memberPage(id: string, name: string, monday = '') {
  return {
    id,
    properties: {
      'Full Name': { title: [{ plain_text: name }] },
      'Unavailable Monday': { rich_text: monday ? [{ plain_text: monday }] : [] },
    },
  };
}

describe('fetchAllRowerAvailability', () => {
  beforeEach(() => {
    process.env.NOTION_MEMBERS_DB_ID = 'members-db';
    queryDataSource.mockReset();
    notionRequest.mockReset();
  });

  it('maps availability for every member from a single members query', async () => {
    const pages = Array.from({ length: 104 }, (_, i) => memberPage(`m-${i}`, `Member ${i}`));
    pages[3] = memberPage('m-3', 'Member 3', '[{"start":"00:00","end":"23:59"}]');
    queryDataSource.mockResolvedValueOnce(pages);

    const result = await fetchAllRowerAvailability();

    expect(queryDataSource).toHaveBeenCalledTimes(1);
    expect(queryDataSource.mock.calls[0][0]).toBe('members-db');
    expect(notionRequest).not.toHaveBeenCalled();
    expect(result).toHaveLength(104);
    expect(result[3]).toMatchObject({
      memberId: 'm-3',
      memberName: 'Member 3',
      monday: [{ start: '00:00', end: '23:59' }],
      sunday: [],
    });
  });

  it('throws when the query fails, so the failure is not cached as an empty result', async () => {
    queryDataSource.mockRejectedValueOnce(new Error('rate limited'));
    await expect(fetchAllRowerAvailability()).rejects.toThrow('rate limited');
  });

  it('is cached for about a minute under the rower-availability tag', () => {
    expect(unstable_cache).toHaveBeenCalledWith(
      fetchAllRowerAvailability,
      expect.any(Array),
      expect.objectContaining({ revalidate: 60, tags: [ROWER_AVAILABILITY_TAG] }),
    );
  });
});
