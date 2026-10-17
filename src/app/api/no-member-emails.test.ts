import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Member emails must never leave the server through a read route (PER-270, audit A8).

const EMAIL = 'rower@example.com';
const MEMBER_ID = '12345678-90ab-cdef-1234-567890abcdef';
const TEST_ID = '1234567890abcdef1234567890abcdef';

const memberPage = {
  id: MEMBER_ID,
  properties: {
    'Full Name': { type: 'title', title: [{ plain_text: 'Ada Rower' }] },
    'Email Address': { type: 'email', email: EMAIL },
    'Member Type': { type: 'select', select: { name: 'Member' } },
  },
};

const marshalPage = {
  id: 'marshal-slot',
  url: 'https://notion.so/m',
  properties: {
    Name: { title: [{ plain_text: 'Slot' }] },
    'Slot Time': { date: { start: '2026-10-17T09:00:00Z', end: null } },
    Person: { relation: [{ id: MEMBER_ID }] },
    Publish: { checkbox: true },
  },
};

const { queryDataSource, request } = vi.hoisted(() => ({ queryDataSource: vi.fn(), request: vi.fn() }));
vi.mock('@/server/notion/query', () => ({ queryDataSource }));
vi.mock('@notionhq/client', () => ({
  Client: class {
    request = request;
  },
}));

import { GET as getMembers } from './get-members/route';
import { GET as getMarshals } from './get-marshals/route';
import { GET as getTest } from './get-test/route';

beforeEach(() => {
  process.env.NOTION_TOKEN = 'test-token';
  process.env.NOTION_MEMBERS_DB_ID = 'members-db';
  vi.clearAllMocks();
  queryDataSource.mockImplementation(async (_db: string, _body: unknown, label: string) =>
    label === 'marshals.query' ? [marshalPage] : [memberPage]
  );
  request.mockImplementation(async ({ path }: { path: string }) =>
    path === `pages/${TEST_ID}`
      ? { id: TEST_ID, url: 'https://notion.so/t', properties: { 'Slot 1': { type: 'relation', relation: [{ id: MEMBER_ID }] } } }
      : memberPage
  );
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('read routes do not return member emails', () => {
  it('GET /api/get-members', async () => {
    const response = await getMembers(new Request('http://localhost/api/get-members'));
    const body = await response.json();
    expect(body.members).toHaveLength(1);
    expect(body.members[0]).not.toHaveProperty('email');
    expect(JSON.stringify(body)).not.toContain(EMAIL);
  });

  it('GET /api/get-marshals', async () => {
    const response = await getMarshals();
    const body = await response.json();
    expect(body.slots[0].person.name).toBe('Ada Rower');
    expect(body.slots[0].person).not.toHaveProperty('email');
    expect(JSON.stringify(body)).not.toContain(EMAIL);
  });

  it('GET /api/get-test', async () => {
    const response = await getTest(new NextRequest(`http://localhost/api/get-test?id=${TEST_ID}`));
    const body = await response.json();
    expect(body.test.slot1[0].name).toBe('Ada Rower');
    expect(body.test.slot1[0]).not.toHaveProperty('email');
    expect(JSON.stringify(body)).not.toContain(EMAIL);
  });
});
