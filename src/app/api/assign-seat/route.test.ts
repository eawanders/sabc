import { beforeEach, describe, expect, it, vi } from 'vitest';

const { update, retrieve } = vi.hoisted(() => ({ update: vi.fn(), retrieve: vi.fn() }));
vi.mock('@notionhq/client', () => ({
  Client: vi.fn(() => ({ pages: { update, retrieve } })),
}));

import { POST } from './route';
import type { NextRequest } from 'next/server';

const OUTING_ID = '0123456789abcdef0123456789abcdef';
const MEMBER_ID = 'fedcba9876543210fedcba9876543210';

function post(body: unknown) {
  return POST(new Request('http://localhost/api/assign-seat', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as unknown as NextRequest);
}

describe('POST /api/assign-seat', () => {
  beforeEach(() => {
    process.env.NOTION_TOKEN = 'test-token';
    update.mockReset();
    retrieve.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('writes the member and the seat status in a single Notion update, without reading back', async () => {
    update.mockResolvedValueOnce({ id: OUTING_ID });
    const response = await post({ outingId: OUTING_ID, seat: 'Sub1', memberId: MEMBER_ID, status: 'Awaiting Approval' });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      page_id: OUTING_ID,
      properties: {
        'Sub 1': { relation: [{ id: MEMBER_ID }] },
        'Sub 1 Status': { status: { name: 'Awaiting Approval' } },
      },
    });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('still writes only the relation when no status is given', async () => {
    update.mockResolvedValueOnce({ id: OUTING_ID });
    const response = await post({ outingId: OUTING_ID, seat: 'Stroke', memberId: MEMBER_ID });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      page_id: OUTING_ID,
      properties: { Stroke: { relation: [{ id: MEMBER_ID }] } },
    });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('rejects an unknown status without writing', async () => {
    const response = await post({ outingId: OUTING_ID, seat: 'Stroke', memberId: MEMBER_ID, status: 'Confirmed' });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});
