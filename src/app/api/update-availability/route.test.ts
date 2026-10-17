import { beforeEach, describe, expect, it, vi } from 'vitest';

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('@notionhq/client', () => ({
  Client: class {
    pages = { update };
  },
}));

import { POST } from './route';

const OUTING = '12345678-90ab-cdef-1234-567890abcdef';

function post(body: unknown) {
  return POST(new Request('http://localhost/api/update-availability', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

describe('POST /api/update-availability statusField allowlist', () => {
  beforeEach(() => {
    process.env.NOTION_TOKEN = 'test-token';
    vi.clearAllMocks();
    update.mockResolvedValue({ id: OUTING });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const rejected: [string, string][] = [
    ['OutingStatus', 'Cancelled'],
    ['Status', 'Cancelled'],
    ['Status', 'Available'],
    ['OutingStatus', 'Confirmed'],
    ['Name', 'Available'],
    ['PublishOuting', 'Available'],
    ['Cox', 'Available'],
  ];
  for (const [statusField, status] of rejected) {
    it(`rejects ${statusField} -> ${status} with 400 and no Notion write`, async () => {
      const response = await post({ outingId: OUTING, statusField, status });
      expect(response.status).toBe(400);
      expect(update).not.toHaveBeenCalled();
    });
  }

  it('rejects a non-string statusField with 400', async () => {
    const response = await post({ outingId: OUTING, statusField: { a: 1 }, status: 'Available' });
    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  // The exact values OutingDrawer sends today (getStatusField + the auto-confirm/de-confirm path).
  const allowed: [string, string, string][] = [
    ['CoxStatus', 'Available', 'Cox Status'],
    ['StrokeStatus', 'Awaiting Approval', 'Stroke Status'],
    ['BowStatus', 'Not Available', 'Bow Status'],
    ['7 SeatStatus', 'Maybe Available', '7 Seat Status'],
    ['2 SeatStatus', 'Reserved', '2 Seat Status'],
    ['BankRiderStatus', 'Available', 'Bank Rider Status'],
    ['Sub1Status', 'Awaiting Approval', 'Sub 1 Status'],
    ['Sub4Status', 'Available', 'Sub 4 Status'],
    ['Status', 'Confirmed', 'Status'],
    ['Status', 'Provisional', 'Status'],
  ];
  for (const [statusField, status, property] of allowed) {
    it(`writes ${statusField} -> ${status} to ${property}`, async () => {
      const response = await post({ outingId: OUTING, statusField, status });
      expect(response.status).toBe(200);
      expect(update).toHaveBeenCalledWith({ page_id: OUTING, properties: { [property]: { status: { name: status } } } });
      expect(await response.json()).toEqual({ success: true, data: { id: OUTING, property, status } });
    });
  }
});
