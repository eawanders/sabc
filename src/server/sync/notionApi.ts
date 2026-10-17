// The three Notion calls the sync makes, behind one pacer so a whole sync
// invocation (inbound sweep + outbox worker) stays under Notion's ~3 req/s.
import { getNotionClient } from '@/server/notion/client';
import type { NotionPage } from './sources';

/** Notion's documented average limit is 3 requests/second; stay at 2.5. */
export const MAX_REQUESTS_PER_SECOND = 2.5;

export class Pacer {
  private nextSlot = 0;

  constructor(
    private readonly minIntervalMs = 1000 / MAX_REQUESTS_PER_SECOND,
    private readonly now: () => number = () => Date.now(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  /** Resolves when the caller may send its next request. */
  async wait(): Promise<void> {
    const now = this.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.minIntervalMs;
    if (slot > now) await this.sleep(slot - now);
  }
}

export interface QueryResult {
  results: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
}

export interface SyncNotion {
  queryDataSource(dataSourceId: string, body: Record<string, unknown>): Promise<QueryResult>;
  retrievePage(pageId: string): Promise<NotionPage>;
  updatePage(pageId: string, properties: Record<string, unknown>): Promise<void>;
}

/** Every call waits for the pacer first, so all calls through one pacer share the budget. */
export function withPacing(api: SyncNotion, pacer: Pacer): SyncNotion {
  return {
    queryDataSource: async (id, body) => (await pacer.wait(), api.queryDataSource(id, body)),
    retrievePage: async (id) => (await pacer.wait(), api.retrievePage(id)),
    updatePage: async (id, properties) => (await pacer.wait(), api.updatePage(id, properties)),
  };
}

// One pacer per server instance, shared by every sync call it makes. Separate
// serverless instances do not share it (see supabase/README.md, risks).
const instancePacer = new Pacer();

export function createSyncNotion(pacer: Pacer = instancePacer): SyncNotion {
  const client = () => getNotionClient();
  return withPacing(
    {
      queryDataSource: (id, body) =>
        client().request<QueryResult>({ method: 'post', path: `data_sources/${id}/query`, body }),
      retrievePage: (id) => client().request<NotionPage>({ method: 'get', path: `pages/${id}` }),
      updatePage: async (id, properties) => {
        await client().request({ method: 'patch', path: `pages/${id}`, body: { properties } });
      },
    },
    pacer,
  );
}

export interface NotionErrorInfo {
  status?: number;
  retryAfterSeconds?: number;
  message: string;
}

/** Status, retry-after and a log-safe message from a @notionhq/client error. */
export function notionErrorInfo(error: unknown): NotionErrorInfo {
  const e = error as { status?: unknown; headers?: unknown; code?: unknown; message?: unknown };
  const status = typeof e?.status === 'number' ? e.status : undefined;
  let retryAfter: string | null | undefined;
  const headers = e?.headers as { get?: (name: string) => string | null } | Record<string, string> | undefined;
  if (headers && typeof (headers as { get?: unknown }).get === 'function') {
    retryAfter = (headers as { get: (name: string) => string | null }).get('retry-after');
  } else if (headers) {
    retryAfter = (headers as Record<string, string>)['retry-after'];
  }
  const parsed = retryAfter != null ? Number(retryAfter) : NaN;
  const code = typeof e?.code === 'string' ? `${e.code}: ` : '';
  const message = `${status ?? 'error'} ${code}${typeof e?.message === 'string' ? e.message : String(error)}`.slice(0, 500);
  return {
    status,
    retryAfterSeconds: Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined,
    message,
  };
}
