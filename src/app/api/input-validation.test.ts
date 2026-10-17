import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Every route that puts a client-supplied id into a Notion API call must reject anything that is
// not a Notion page id before Notion is called (PER-270, audit A14). `../users/me` reached
// /v1/users/me in production.

const { notion, notionRequest } = vi.hoisted(() => ({
  notion: {
    pages: { update: vi.fn(), retrieve: vi.fn() },
    request: vi.fn(),
  },
  notionRequest: vi.fn(),
}));

vi.mock('@notionhq/client', () => ({
  Client: class {
    pages = notion.pages;
    request = notion.request;
  },
}));
vi.mock('@/server/notion/client', () => ({ notionRequest }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: vi.fn((fn: unknown) => fn) }));

import { GET as getOuting } from './get-outing/[id]/route';
import { GET as getOutingReport } from './get-outing-report/[id]/route';
import { GET as getTest } from './get-test/route';
import { GET as getRowerAvailability } from './get-rower-availability/route';
import { POST as updateRowerAvailability } from './update-rower-availability/route';
import { POST as assignSeat } from './assign-seat/route';
import { POST as swapSeats } from './swap-seats/route';
import { POST as updateAvailability } from './update-availability/route';
import { POST as submitOutingReport } from './submit-outing-report/route';
import { POST as assignMarshal } from './assign-marshal/route';
import { POST as assignTestSlot } from './assign-test-slot/route';
import { POST as updateTestOutcome } from './update-test-outcome/route';

const HEX = '1234567890abcdef1234567890abcdef';
const UUID = '12345678-90ab-cdef-1234-567890abcdef';
const TRAVERSAL = '../users/me';
const week = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };

type Call = (id: string) => Promise<Response>;
type Handler = (req: NextRequest) => Promise<Response>;

function post(handler: Handler, body: unknown) {
  return handler(new NextRequest('http://localhost/api/x', { method: 'POST', body: JSON.stringify(body) }));
}
function postRaw(handler: Handler, raw: string) {
  return handler(new NextRequest('http://localhost/api/x', { method: 'POST', body: raw }));
}
function get(handler: Handler, query: string) {
  return handler(new NextRequest(`http://localhost/api/x?${query}`));
}

// Each route, called with `id` in the position under test.
const idRoutes: Record<string, Call> = {
  'get-outing/[id]': (id) => getOuting(new Request('http://localhost/api/get-outing/x'), { params: Promise.resolve({ id }) }),
  'get-outing-report/[id]': (id) => getOutingReport(new Request('http://localhost/api/get-outing-report/x'), { params: Promise.resolve({ id }) }),
  'get-test id': (id) => get(getTest, `id=${encodeURIComponent(id)}`),
  'get-rower-availability memberId': (id) => get(getRowerAvailability, `memberId=${encodeURIComponent(id)}`),
  'update-rower-availability memberId': (id) => post(updateRowerAvailability, { memberId: id, ...week }),
  'assign-seat outingId': (id) => post(assignSeat, { outingId: id, seat: 'Cox', memberId: HEX }),
  'assign-seat memberId': (id) => post(assignSeat, { outingId: HEX, seat: 'Cox', memberId: id }),
  'swap-seats outingId': (id) => post(swapSeats, { outingId: id, seats: [{ seat: 'Cox', memberId: HEX, status: 'Available' }, { seat: 'Sub1', memberId: UUID, status: 'Available' }] }),
  'swap-seats memberId': (id) => post(swapSeats, { outingId: HEX, seats: [{ seat: 'Cox', memberId: id, status: 'Available' }, { seat: 'Sub1', memberId: UUID, status: 'Available' }] }),
  'update-availability outingId': (id) => post(updateAvailability, { outingId: id, statusField: 'CoxStatus', status: 'Available' }),
  'submit-outing-report outingId': (id) => post(submitOutingReport, { outingId: id, outingSummary: 'x' }),
  'assign-marshal slotId': (id) => post(assignMarshal, { slotId: id, memberId: HEX }),
  'assign-marshal memberId': (id) => post(assignMarshal, { slotId: HEX, memberId: id }),
  'assign-test-slot testId': (id) => post(assignTestSlot, { testId: id, slotNumber: 1, memberId: HEX }),
  'assign-test-slot memberId': (id) => post(assignTestSlot, { testId: HEX, slotNumber: 1, memberId: id }),
  'update-test-outcome testId': (id) => post(updateTestOutcome, { testId: id, slotNumber: 1, outcome: 'Passed' }),
};

const postRoutes = {
  'update-rower-availability': updateRowerAvailability,
  'assign-seat': assignSeat,
  'swap-seats': swapSeats,
  'update-availability': updateAvailability,
  'submit-outing-report': submitOutingReport,
  'assign-marshal': assignMarshal,
  'assign-test-slot': assignTestSlot,
  'update-test-outcome': updateTestOutcome,
};

function expectNoNotionCall() {
  expect(notion.pages.update).not.toHaveBeenCalled();
  expect(notion.pages.retrieve).not.toHaveBeenCalled();
  expect(notion.request).not.toHaveBeenCalled();
  expect(notionRequest).not.toHaveBeenCalled();
}

function notionWasCalled() {
  return (
    notion.pages.update.mock.calls.length +
      notion.pages.retrieve.mock.calls.length +
      notion.request.mock.calls.length +
      notionRequest.mock.calls.length >
    0
  );
}

beforeEach(() => {
  process.env.NOTION_TOKEN = 'test-token';
  vi.clearAllMocks();
  const page = { id: UUID, url: 'https://notion.so/x', properties: {} };
  notion.pages.update.mockResolvedValue(page);
  notion.pages.retrieve.mockResolvedValue(page);
  notion.request.mockResolvedValue(page);
  notionRequest.mockResolvedValue(page);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Notion id validation', () => {
  for (const [name, call] of Object.entries(idRoutes)) {
    it(`${name}: rejects a path-traversal id with 400 before calling Notion`, async () => {
      const response = await call(TRAVERSAL);
      expect(response.status).toBe(400);
      expectNoNotionCall();
    });

    it(`${name}: rejects a 32-char non-hex id with 400`, async () => {
      const response = await call('z'.repeat(32));
      expect(response.status).toBe(400);
      expectNoNotionCall();
    });

    for (const [form, id] of [['unhyphenated', HEX], ['hyphenated', UUID]] as const) {
      it(`${name}: accepts a ${form} id`, async () => {
        const response = await call(id);
        expect(response.status).toBe(200);
        expect(notionWasCalled()).toBe(true);
      });
    }
  }
});

describe('malformed JSON', () => {
  for (const [name, handler] of Object.entries(postRoutes)) {
    it(`${name}: returns 400 for an unparseable body without calling Notion`, async () => {
      const response = await postRaw(handler, '{not json');
      expect(response.status).toBe(400);
      expectNoNotionCall();
    });
  }
});

describe('slotNumber validation', () => {
  const cases: [string, unknown][] = [
    ['a non-number string', 'abc'],
    ['a numeric string', '3'],
    ['a fraction', 1.5],
    ['zero', 0],
    ['seven', 7],
  ];
  for (const [label, slotNumber] of cases) {
    it(`assign-test-slot rejects ${label}`, async () => {
      const response = await post(assignTestSlot, { testId: HEX, slotNumber, memberId: HEX });
      expect(response.status).toBe(400);
      expectNoNotionCall();
    });
    it(`update-test-outcome rejects ${label}`, async () => {
      const response = await post(updateTestOutcome, { testId: HEX, slotNumber, outcome: 'Passed' });
      expect(response.status).toBe(400);
      expectNoNotionCall();
    });
  }
});

describe('Notion error text is not returned to the client', () => {
  const secret = 'notion-internal-detail-xyz';
  for (const [name, call] of Object.entries(idRoutes)) {
    it(`${name}: hides the Notion error message`, async () => {
      const failure = new Error(secret);
      notion.pages.update.mockRejectedValue(failure);
      notion.pages.retrieve.mockRejectedValue(failure);
      notion.request.mockRejectedValue(failure);
      notionRequest.mockRejectedValue(failure);
      const response = await call(HEX);
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await response.text()).not.toContain(secret);
    });
  }
});
