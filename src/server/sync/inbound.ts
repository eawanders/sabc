// Inbound sync: Notion -> Postgres for the Notion-owned tables.
//
// Incremental by default: each source keeps a cursor (newest last_edited_time
// already upserted) in sync_state and asks Notion only for pages edited on or
// after it, oldest first, so a run cut short by its deadline resumes cleanly.
//
// Deletions ("soft" approach): a page Notion reports as archived/in_trash has
// its row deleted. Incremental queries never return trashed pages, so deletes
// arrive through the webhook (reconcilePage) or a full sweep, which deletes
// rows whose page no longer appears in the data source. Deleting an outing
// cascades to its seats and report; deleting a member clears their seats.
import type { SyncDb } from './db';
import type { SyncNotion } from './notionApi';
import { notionErrorInfo } from './notionApi';
import { SOURCES, canonicalId, isTrashed, type NotionPage, type Row, type SourceDef } from './sources';

export interface InboundOptions {
  /** Ignore the cursor, read everything, and delete rows whose page has gone. */
  full?: boolean;
  /** Epoch ms after which no new Notion request is started. */
  deadline?: number;
  clock?: () => number;
}

export interface SourceResult {
  source: string;
  upserted: number;
  deleted: number;
  skipped: number;
  complete: boolean;
  error?: string;
}

const later = (a: string | null, b: string | undefined) =>
  !b ? a : !a || Date.parse(b) > Date.parse(a) ? b : a;

export async function syncSource(
  notion: SyncNotion,
  db: SyncDb,
  source: SourceDef,
  options: InboundOptions = {},
): Promise<SourceResult> {
  const clock = options.clock ?? Date.now;
  const result: SourceResult = { source: source.key, upserted: 0, deleted: 0, skipped: 0, complete: false };
  const state = await db.getState(source.key);
  const since = options.full ? null : state.cursor;
  const seen = new Set<string>();
  let cursor = state.cursor;
  let startCursor: string | undefined;

  try {
    do {
      if (options.deadline !== undefined && clock() >= options.deadline) break;
      const page = await notion.queryDataSource(source.dataSourceId, {
        page_size: 100,
        sorts: [{ timestamp: 'last_edited_time', direction: 'ascending' }],
        ...(since ? { filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: since } } } : {}),
        ...(startCursor ? { start_cursor: startCursor } : {}),
      });

      const rows: Row[] = [];
      const trashed: string[] = [];
      for (const notionPage of page.results ?? []) {
        const id = canonicalId(notionPage.id);
        if (isTrashed(notionPage)) {
          trashed.push(id);
          continue;
        }
        seen.add(id);
        const row = source.map(notionPage);
        if (row) rows.push(row);
        else result.skipped++;
        cursor = later(cursor, notionPage.last_edited_time);
      }
      if (rows.length) await db.upsert(source.table, rows);
      if (trashed.length) await db.deleteByIds(source.table, trashed);
      result.upserted += rows.length;
      result.deleted += trashed.length;
      // Save progress per Notion page of results, so a deadline loses nothing.
      await db.saveRun(source.key, { cursor: cursor ?? undefined, error: null });

      startCursor = page.has_more ? page.next_cursor ?? undefined : undefined;
      if (!startCursor) result.complete = true;
    } while (startCursor);

    // Only a complete full read may infer deletions, and never from an empty
    // result (a misconfigured or unshared data source would wipe the table).
    if (options.full && result.complete && seen.size > 0) {
      const existing = (await db.selectAll(source.table, 'id')).map((r) => String(r.id));
      const gone = existing.filter((id) => !seen.has(id));
      if (gone.length) await db.deleteByIds(source.table, gone);
      result.deleted += gone.length;
    }
  } catch (error) {
    result.error = notionErrorInfo(error).message;
    await db.saveRun(source.key, { error: result.error });
  }
  return result;
}

/** Members first (seats and sign-ups reference them), then the rest. */
export async function syncAll(notion: SyncNotion, db: SyncDb, options: InboundOptions = {}) {
  const results: SourceResult[] = [];
  for (const source of SOURCES) {
    results.push(await syncSource(notion, db, source, options));
  }
  return results;
}

/** Re-reads one page and applies it: trashed -> delete the row, otherwise upsert it. */
export async function reconcilePage(notion: SyncNotion, db: SyncDb, source: SourceDef, pageId: string) {
  const page: NotionPage = await notion.retrievePage(pageId);
  const id = canonicalId(page.id ?? pageId);
  if (isTrashed(page)) {
    await db.deleteByIds(source.table, [id]);
    return 'deleted' as const;
  }
  const row = source.map(page);
  if (!row) return 'skipped' as const;
  await db.upsert(source.table, [row]);
  return 'upserted' as const;
}
