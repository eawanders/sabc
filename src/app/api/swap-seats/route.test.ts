import { beforeEach, describe, expect, it, vi } from 'vitest';

const { update, retrieve } = vi.hoisted(() => ({ update: vi.fn(), retrieve: vi.fn() }));
vi.mock('@notionhq/client', () => ({
  Client: vi.fn(() => ({ pages: { update, retrieve } })),
}));

import { POST } from './route';

const OUTING_ID = '0123456789abcdef0123456789abcdef';
const ROWER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SUB_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function post(body: unknown) {
  return POST(new Request('http://localhost/api/swap-seats', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

describe('POST /api/swap-seats', () => {
  beforeEach(() => {
    process.env.NOTION_TOKEN = 'test-token';
    update.mockReset();
    retrieve.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('writes both seats\' members and statuses in one Notion update', async () => {
    update.mockResolvedValueOnce({ id: OUTING_ID });
    const response = await post({
      outingId: OUTING_ID,
      seats: [
        { seat: '7 Seat', memberId: SUB_ID, status: 'Available' },
        { seat: 'Sub2', memberId: ROWER_ID, status: 'Not Available' },
      ],
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      page_id: OUTING_ID,
      properties: {
        '7 Seat': { relation: [{ id: SUB_ID }] },
        '7 Seat Status': { status: { name: 'Available' } },
        'Sub 2': { relation: [{ id: ROWER_ID }] },
        'Sub 2 Status': { status: { name: 'Not Available' } },
      },
    });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown seat', [{ seat: 'Name', memberId: SUB_ID, status: 'Available' }, { seat: 'Sub1', memberId: ROWER_ID, status: 'Available' }]],
    ['the same seat twice', [{ seat: 'Bow', memberId: SUB_ID, status: 'Available' }, { seat: 'Bow', memberId: ROWER_ID, status: 'Available' }]],
    ['an unknown status', [{ seat: 'Bow', memberId: SUB_ID, status: 'Confirmed' }, { seat: 'Sub1', memberId: ROWER_ID, status: 'Available' }]],
    ['a missing member', [{ seat: 'Bow', memberId: null, status: 'Available' }, { seat: 'Sub1', memberId: ROWER_ID, status: 'Available' }]],
    ['no seats', []],
  ])('rejects %s without writing', async (_label, seats) => {
    const response = await post({ outingId: OUTING_ID, seats });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 500 without Notion details when the write fails', async () => {
    update.mockRejectedValueOnce(new Error('rate limited secret detail'));
    const response = await post({
      outingId: OUTING_ID,
      seats: [
        { seat: 'Bow', memberId: SUB_ID, status: 'Available' },
        { seat: 'Sub1', memberId: ROWER_ID, status: 'Not Available' },
      ],
    });

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret detail');
  });
});
