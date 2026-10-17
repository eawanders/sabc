// The Postgres side of the sync, as a small interface so the sync logic can be
// unit-tested against a fake. The real implementation uses supabase-js with the
// service role key (server only; it bypasses RLS).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Row, SourceKey } from './sources';

export interface SyncStateRow {
  cursor: string | null;
  last_run_at: string | null;
}

export interface OutboxRow {
  id: number;
  entity: string;
  entity_key: { page_id?: string };
  payload: Record<string, unknown>;
  revision: number;
  attempts: number;
}

export interface OutboxFailure {
  attempts: number;
  next_attempt_at: string;
  last_error: string;
}

export interface SyncDb {
  getState(source: SourceKey): Promise<SyncStateRow>;
  /** Records a run; `cursor` is only written when given. */
  saveRun(source: SourceKey, run: { cursor?: string; error: string | null }): Promise<void>;
  upsert(table: string, rows: Row[], onConflict?: string): Promise<void>;
  updateWhere(table: string, match: Row, values: Row): Promise<void>;
  deleteByIds(table: string, ids: string[]): Promise<void>;
  selectAll(table: string, columns: string): Promise<Row[]>;
  pendingOutbox(limit: number, now: Date): Promise<OutboxRow[]>;
  completeOutbox(id: number, revision: number): Promise<boolean>;
  failOutbox(id: number, failure: OutboxFailure): Promise<void>;
  saveWebhookToken(token: string): Promise<void>;
  /** Applies Notion's outing statuses through the sync_outing_statuses ownership rule. */
  syncOutingStatuses(rows: { id: string; status: string | null }[]): Promise<void>;
  getOutingStatus(id: string): Promise<string | null>;
}

const CHUNK = 500;
const PAGE = 1000; // supabase/config.toml api.max_rows

function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

export function createSupabaseSyncDb(client: SupabaseClient): SyncDb {
  return {
    async getState(source) {
      const data = check(
        await client.from('sync_state').select('cursor, last_run_at').eq('source', source).maybeSingle(),
        'read sync_state',
      ) as SyncStateRow | null;
      return data ?? { cursor: null, last_run_at: null };
    },

    async saveRun(source, run) {
      const row: Row = { source, last_run_at: new Date().toISOString(), last_error: run.error };
      if (run.cursor !== undefined) row.cursor = run.cursor;
      check(await client.from('sync_state').upsert(row, { onConflict: 'source' }), 'write sync_state');
    },

    async upsert(table, rows, onConflict = 'id') {
      for (let i = 0; i < rows.length; i += CHUNK) {
        check(await client.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict }), `upsert ${table}`);
      }
    },

    async updateWhere(table, match, values) {
      check(await client.from(table).update(values).match(match), `update ${table}`);
    },

    async deleteByIds(table, ids) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        check(await client.from(table).delete().in('id', ids.slice(i, i + CHUNK)), `delete ${table}`);
      }
    },

    async selectAll(table, columns) {
      const rows: Row[] = [];
      for (let from = 0; ; from += PAGE) {
        const page = check(
          await client.from(table).select(columns).order(columns.split(',')[0].trim()).range(from, from + PAGE - 1),
          `read ${table}`,
        ) as unknown as Row[];
        rows.push(...page);
        if (page.length < PAGE) return rows;
      }
    },

    async pendingOutbox(limit, now) {
      return check(
        await client
          .from('notion_outbox')
          .select('id, entity, entity_key, payload, revision, attempts')
          .is('done_at', null)
          .lte('next_attempt_at', now.toISOString())
          .order('next_attempt_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(limit),
        'read notion_outbox',
      ) as OutboxRow[];
    },

    async completeOutbox(id, revision) {
      return check(
        await client.rpc('complete_notion_outbox', { p_id: id, p_revision: revision }),
        'complete_notion_outbox',
      ) as boolean;
    },

    async failOutbox(id, failure) {
      check(
        await client.from('notion_outbox').update(failure).eq('id', id).is('done_at', null),
        'update notion_outbox',
      );
    },

    async saveWebhookToken(token) {
      check(await client.from('notion_webhook_handshake').insert({ token }), 'write notion_webhook_handshake');
    },

    async syncOutingStatuses(rows) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        check(
          await client.rpc('sync_outing_statuses', { p_statuses: rows.slice(i, i + CHUNK) }),
          'sync_outing_statuses',
        );
      }
    },

    async getOutingStatus(id) {
      const data = check(
        await client.from('outings').select('status').eq('id', id).maybeSingle(),
        'read outings.status',
      ) as { status: string | null } | null;
      return data?.status ?? null;
    },
  };
}

export function createServiceRoleSyncDb(): SyncDb {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createSupabaseSyncDb(
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
}
