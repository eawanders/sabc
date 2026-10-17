// Outbound mirror: Postgres -> Notion. Sends pending notion_outbox rows (oldest
// due first) as page PATCHes, then completes each with the revision it sent.
// A row edited mid-flight fails the revision check and stays pending, so the
// merged payload goes out on a later pass. Failures back off exponentially with
// jitter; a 429 honours Notion's retry-after and ends the run, since Notion's
// limit is per integration and every further request would also be refused.
import type { OutboxRow, SyncDb } from './db';
import type { SyncNotion } from './notionApi';
import { notionErrorInfo } from './notionApi';

export const BACKOFF_BASE_MS = 10_000;
export const BACKOFF_MAX_MS = 60 * 60_000;
const PAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface OutboxOptions {
  /** Epoch ms after which no new row is started. */
  deadline: number;
  batchSize?: number;
  clock?: () => number;
  random?: () => number;
}

export interface OutboxResult {
  sent: number;
  stale: number;
  failed: number;
  rateLimited: boolean;
}

/** Exponential backoff with jitter: base * 2^(attempts-1), capped, scaled into [50%, 100%]. */
export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
  return Math.round(ceiling * (0.5 + random() * 0.5));
}

export async function runOutbox(notion: SyncNotion, db: SyncDb, options: OutboxOptions): Promise<OutboxResult> {
  const clock = options.clock ?? Date.now;
  const random = options.random ?? Math.random;
  const result: OutboxResult = { sent: 0, stale: 0, failed: 0, rateLimited: false };
  // Each (row, revision) is attempted at most once per run; a row whose revision
  // moved on (edited while in flight) is picked up again with its new payload.
  const attempted = new Map<number, number>();

  while (clock() < options.deadline) {
    const due = await db.pendingOutbox(options.batchSize ?? 25, new Date(clock()));
    const fresh = due.filter((row) => attempted.get(row.id) !== row.revision);
    if (fresh.length === 0) break;

    for (const row of fresh) {
      if (clock() >= options.deadline) return result;
      attempted.set(row.id, row.revision);
      const outcome = await sendRow(notion, db, row, clock, random);
      if (outcome === 'sent') result.sent++;
      else if (outcome === 'stale') result.stale++;
      else {
        result.failed++;
        if (outcome === 'rate-limited') {
          result.rateLimited = true;
          return result;
        }
      }
    }
  }
  return result;
}

async function sendRow(
  notion: SyncNotion,
  db: SyncDb,
  row: OutboxRow,
  clock: () => number,
  random: () => number,
): Promise<'sent' | 'stale' | 'failed' | 'rate-limited'> {
  const pageId = row.entity_key?.page_id;
  try {
    if (typeof pageId !== 'string' || !PAGE_ID.test(pageId)) {
      throw new Error('outbox row has no valid entity_key.page_id');
    }
    await notion.updatePage(pageId, row.payload);
  } catch (error) {
    const info = notionErrorInfo(error);
    const attempts = row.attempts + 1;
    const rateLimited = info.status === 429;
    const delay =
      rateLimited && info.retryAfterSeconds !== undefined
        ? info.retryAfterSeconds * 1000 + Math.round(random() * 1000)
        : backoffMs(attempts, random);
    await db.failOutbox(row.id, {
      attempts,
      next_attempt_at: new Date(clock() + delay).toISOString(),
      last_error: info.message,
    });
    return rateLimited ? 'rate-limited' : 'failed';
  }
  return (await db.completeOutbox(row.id, row.revision)) ? 'sent' : 'stale';
}
