import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMembersByIds, getOutingWithMembers } from './outings';
import { SeatType } from '@/types/outing';

const STROKE_ID = '11111111-1111-1111-1111-111111111111';
const COX_ID = '22222222-2222-2222-2222-222222222222';

// Both seats are occupied in Notion but have a blank status, which the app reads as "Awaiting Approval"
const outing = {
  id: 'outing-1',
  created_time: '2026-10-01T00:00:00.000Z',
  last_edited_time: '2026-10-01T00:00:00.000Z',
  properties: {
    Stroke: { relation: [{ id: STROKE_ID }] },
    StrokeStatus: { status: null },
    Cox: { relation: [{ id: COX_ID }] },
    CoxStatus: { status: { name: 'Awaiting Approval' } },
    Bow: { relation: [] },
    BowStatus: { status: { name: 'Awaiting Approval' } },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockFetch(membersResponse: () => Response) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/get-outing/')) return json({ outing });
    if (url.startsWith('/api/get-members')) return membersResponse();
    throw new Error(`unexpected fetch ${url}`);
  }));
}

describe('getOutingWithMembers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('surfaces a failed members fetch instead of treating every seat as empty', async () => {
    mockFetch(() => json({ error: 'Failed to fetch members' }, 500));

    await expect(getMembersByIds([STROKE_ID])).rejects.toThrow();
    await expect(getOutingWithMembers('outing-1')).rejects.toThrow();
  });

  it('marks a seat whose member cannot be resolved as occupied, not available', async () => {
    // Members fetch works but does not include the Stroke member (e.g. filtered out or stale)
    mockFetch(() => json({ members: [{ id: COX_ID, name: 'Cox Person', email: '', memberType: 'Member' }] }));

    const detailed = await getOutingWithMembers('outing-1');
    const stroke = detailed!.seatAssignments.find((s) => s.seatType === SeatType.Stroke)!;
    const cox = detailed!.seatAssignments.find((s) => s.seatType === SeatType.Cox)!;
    const bow = detailed!.seatAssignments.find((s) => s.seatType === SeatType.Bow)!;

    expect(stroke.isAvailable).toBe(false);
    expect(stroke.member).toMatchObject({ id: STROKE_ID });
    expect(cox.isAvailable).toBe(false);
    expect(cox.member).toMatchObject({ id: COX_ID, name: 'Cox Person' });
    expect(bow.isAvailable).toBe(true);
    expect(detailed!.availableSeats).not.toContain(SeatType.Stroke);
    expect(detailed!.availableSeats).toContain(SeatType.Bow);
  });
});
