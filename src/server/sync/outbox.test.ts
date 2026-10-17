import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pacer, withPacing, type SyncNotion } from './notionApi';
import { backoffMs, runOutbox, BACKOFF_BASE_MS, BACKOFF_MAX_MS } from './outbox';
import { FakeDb } from './testing';

const PAGE_1 = 'bbbbbbbb-0000-4000-8000-000000000001';
const PAGE_2 = 'bbbbbbbb-0000-4000-8000-000000000002';
const NOW = Date.parse('2026-10-17T12:00:00.000Z');

function queued(db: FakeDb, id: number, pageId: string, extra: Partial<FakeDb['outbox'][number]> = {}) {
  db.outbox.push({
    id,
    entity: 'outing',
    entity_key: { page_id: pageId },
    payload: { 'Bow Status': { status: { name: 'Available' } } },
    revision: 1,
    attempts: 0,
    done: false,
    next_attempt_at: new Date(NOW - 1000).toISOString(),
    ...extra,
  });
}

const notionWith = (updatePage: SyncNotion['updatePage']): SyncNotion => ({
  queryDataSource: vi.fn(),
  retrievePage: vi.fn(),
  updatePage: vi.fn(updatePage),
});

const options = { deadline: NOW + 50_000, clock: () => NOW, random: () => 0.5 };

afterEach(() => vi.useRealTimers());

describe('runOutbox', () => {
  it('PATCHes the page with the payload and completes the row with the revision it sent', async () => {
    const db = new FakeDb();
    queued(db, 1, PAGE_1, { revision: 4 });
    const notion = notionWith(async () => {});
    const complete = vi.spyOn(db, 'completeOutbox');

    const result = await runOutbox(notion, db, options);

    expect(notion.updatePage).toHaveBeenCalledWith(PAGE_1, { 'Bow Status': { status: { name: 'Available' } } });
    expect(complete).toHaveBeenCalledWith(1, 4);
    expect(result).toMatchObject({ sent: 1, stale: 0, failed: 0 });
    expect(db.outbox[0].done).toBe(true);
  });

  it('leaves a row pending when it was edited mid-flight, and sends the new revision once', async () => {
    const db = new FakeDb();
    queued(db, 1, PAGE_1);
    let calls = 0;
    const notion = notionWith(async () => {
      calls++;
      if (calls === 1) {
        // Someone claims another seat while the first PATCH is in flight.
        db.outbox[0].revision = 2;
        db.outbox[0].payload = { ...db.outbox[0].payload, 'Cox Status': { status: { name: 'Reserved' } } };
      }
    });

    const result = await runOutbox(notion, db, options);

    expect(result).toMatchObject({ sent: 1, stale: 1 });
    expect(notion.updatePage).toHaveBeenCalledTimes(2);
    expect(notion.updatePage).toHaveBeenLastCalledWith(PAGE_1, expect.objectContaining({ 'Cox Status': expect.anything() }));
    expect(db.outbox[0].done).toBe(true);
  });

  it('a stale completion alone leaves the row pending', async () => {
    const db = new FakeDb();
    queued(db, 1, PAGE_1);
    vi.spyOn(db, 'completeOutbox').mockResolvedValue(false);
    const result = await runOutbox(notionWith(async () => {}), db, options);
    expect(result.stale).toBe(1);
    expect(db.outbox[0].done).toBe(false);
  });

  it('on 429 schedules a retry after retry-after, records the error and stops the run', async () => {
    const db = new FakeDb();
    queued(db, 1, PAGE_1, { attempts: 2 });
    queued(db, 2, PAGE_2);
    const notion = notionWith(async () => {
      throw Object.assign(new Error('Rate limited'), {
        status: 429,
        code: 'rate_limited',
        headers: new Headers({ 'retry-after': '30' }),
      });
    });

    const result = await runOutbox(notion, db, options);

    expect(result).toMatchObject({ rateLimited: true, failed: 1 });
    expect(notion.updatePage).toHaveBeenCalledTimes(1);
    expect(db.failures[0]).toEqual({
      id: 1,
      failure: {
        attempts: 3,
        next_attempt_at: new Date(NOW + 30_000 + 500).toISOString(),
        last_error: '429 rate_limited: Rate limited',
      },
    });
  });

  it('backs off exponentially with jitter on other errors and carries on', async () => {
    const db = new FakeDb();
    queued(db, 1, PAGE_1, { attempts: 3 });
    queued(db, 2, PAGE_2);
    const notion = notionWith(async (pageId) => {
      if (pageId === PAGE_1) throw Object.assign(new Error('Bad gateway'), { status: 502 });
    });

    const result = await runOutbox(notion, db, options);

    expect(result).toMatchObject({ sent: 1, failed: 1, rateLimited: false });
    expect(db.failures[0].failure.attempts).toBe(4);
    expect(db.failures[0].failure.next_attempt_at).toBe(new Date(NOW + backoffMs(4, () => 0.5)).toISOString());
  });

  it('does not start rows after the deadline', async () => {
    const db = new FakeDb();
    queued(db, 1, PAGE_1);
    const result = await runOutbox(notionWith(async () => {}), db, { ...options, deadline: NOW });
    expect(result.sent).toBe(0);
  });

  it('fails a row without a valid page id instead of sending it', async () => {
    const db = new FakeDb();
    queued(db, 1, 'not-a-page');
    const notion = notionWith(async () => {});
    await runOutbox(notion, db, options);
    expect(notion.updatePage).not.toHaveBeenCalled();
    expect(db.failures[0].failure.last_error).toContain('page_id');
  });
});

describe('backoffMs', () => {
  it('doubles per attempt within [50%, 100%] of the ceiling, capped at an hour', () => {
    expect(backoffMs(1, () => 0)).toBe(BACKOFF_BASE_MS / 2);
    expect(backoffMs(1, () => 1)).toBe(BACKOFF_BASE_MS);
    expect(backoffMs(3, () => 1)).toBe(BACKOFF_BASE_MS * 4);
    expect(backoffMs(30, () => 1)).toBe(BACKOFF_MAX_MS);
  });
});

describe('pacing', () => {
  it('never sends more than 2.5 requests per second', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const sentAt: number[] = [];
    const notion = withPacing(notionWith(async () => void sentAt.push(Date.now())), new Pacer());
    const db = new FakeDb();
    for (let i = 1; i <= 10; i++) queued(db, i, `bbbbbbbb-0000-4000-8000-00000000000${i % 10}`);

    const run = runOutbox(notion, db, { deadline: NOW + 50_000 });
    await vi.runAllTimersAsync();
    await run;

    expect(sentAt).toHaveLength(10);
    for (let i = 1; i < sentAt.length; i++) expect(sentAt[i] - sentAt[i - 1]).toBeGreaterThanOrEqual(400);
    // Any 1-second window holds at most 3 starts (2.5/s rounded up at the window edges).
    for (let i = 0; i < sentAt.length; i++) {
      expect(sentAt.filter((t) => t >= sentAt[i] && t < sentAt[i] + 1000).length).toBeLessThanOrEqual(3);
    }
    expect(sentAt[9] - sentAt[0]).toBeGreaterThanOrEqual(3600);
  });
});
