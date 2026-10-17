import { beforeEach, describe, expect, it, vi } from 'vitest';

const { notionRequest, revalidateTag } = vi.hoisted(() => ({ notionRequest: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/server/notion/client', () => ({ notionRequest }));
vi.mock('next/cache', () => ({ revalidateTag, unstable_cache: vi.fn((fn: unknown) => fn) }));

import { POST } from './route';
import { ROWER_AVAILABILITY_TAG } from '@/server/notion/rowerAvailability';

const MEMBER = '12345678-90ab-cdef-1234-567890abcdef';
const week = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };

function post(body: unknown) {
  return POST(new Request('http://localhost/api/update-rower-availability', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

describe('POST /api/update-rower-availability', () => {
  beforeEach(() => {
    notionRequest.mockReset();
    revalidateTag.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('revalidates the all-members availability cache after a successful save', async () => {
    notionRequest.mockResolvedValueOnce({});
    const response = await post({ memberId: MEMBER, ...week });

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith(ROWER_AVAILABILITY_TAG);
  });

  it('does not revalidate when the Notion write fails', async () => {
    notionRequest.mockRejectedValueOnce(new Error('boom'));
    const response = await post({ memberId: MEMBER, ...week });

    expect(response.status).toBe(500);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
