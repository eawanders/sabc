// In-memory SyncDb and Notion page builders for the sync unit tests.
import type { OutboxFailure, OutboxRow, SyncDb, SyncStateRow } from './db';
import type { NotionPage, Row, SourceKey } from './sources';

const KEYS: Record<string, string[]> = {
  outing_seats: ['outing_id', 'seat'],
  swim_test_slots: ['test_id', 'slot'],
  outing_reports: ['outing_id'],
  member_unavailability: ['member_id'],
};

export class FakeDb implements SyncDb {
  tables = new Map<string, Row[]>();
  state = new Map<SourceKey, SyncStateRow & { last_error?: string | null }>();
  upserts: { table: string; rows: Row[] }[] = [];
  deletes: { table: string; ids: string[] }[] = [];
  outbox: (OutboxRow & { done: boolean; next_attempt_at: string; last_error?: string })[] = [];
  failures: { id: number; failure: OutboxFailure }[] = [];
  tokens: string[] = [];

  rows(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  async getState(source: SourceKey) {
    return this.state.get(source) ?? { cursor: null, last_run_at: null };
  }

  async saveRun(source: SourceKey, run: { cursor?: string; error: string | null }) {
    const prev = this.state.get(source) ?? { cursor: null, last_run_at: null };
    this.state.set(source, {
      cursor: run.cursor !== undefined ? run.cursor : prev.cursor,
      last_run_at: new Date().toISOString(),
      last_error: run.error,
    });
  }

  async upsert(table: string, rows: Row[], onConflict = 'id') {
    if (rows.length) this.upserts.push({ table, rows });
    const keys = KEYS[table] ?? onConflict.split(',');
    const all = this.rows(table);
    for (const row of rows) {
      const existing = all.find((r) => keys.every((k) => r[k] === row[k]));
      if (existing) Object.assign(existing, row, { version: Number(existing.version ?? 0) + 1 });
      else all.push({ version: 0, ...row });
    }
  }

  async updateWhere(table: string, match: Row, values: Row) {
    for (const r of this.rows(table)) {
      if (Object.entries(match).every(([k, v]) => r[k] === v)) Object.assign(r, values);
    }
  }

  async deleteByIds(table: string, ids: string[]) {
    this.deletes.push({ table, ids });
    this.tables.set(table, this.rows(table).filter((r) => !ids.includes(String(r.id))));
  }

  async selectAll(table: string) {
    return this.rows(table).map((r) => ({ ...r }));
  }

  async pendingOutbox(limit: number, now: Date) {
    return this.outbox
      .filter((r) => !r.done && Date.parse(r.next_attempt_at) <= now.getTime())
      .slice(0, limit)
      .map(({ id, entity, entity_key, payload, revision, attempts }) => ({
        id, entity, entity_key, payload, revision, attempts,
      }));
  }

  async completeOutbox(id: number, revision: number) {
    const row = this.outbox.find((r) => r.id === id && !r.done);
    if (!row || row.revision !== revision) return false;
    row.done = true;
    return true;
  }

  async failOutbox(id: number, failure: OutboxFailure) {
    this.failures.push({ id, failure });
    const row = this.outbox.find((r) => r.id === id);
    if (row) Object.assign(row, failure);
  }

  async saveWebhookToken(token: string) {
    this.tokens.push(token);
  }

  statusCalls: { id: string; status: string | null }[][] = [];

  /** Same rule as public.sync_outing_status (tested in pgTAP 05). */
  async syncOutingStatuses(rows: { id: string; status: string | null }[]) {
    this.statusCalls.push(rows);
    for (const { id, status } of rows) {
      const outing = this.rows('outings').find((r) => r.id === id);
      if (!outing) continue;
      const pending = this.outbox.find((r) => !r.done && r.entity === 'outing' && r.entity_key.page_id === id);
      if (status === 'Cancelled') {
        outing.status = 'Cancelled';
        if (pending && 'Status' in pending.payload) {
          const { Status: _dropped, ...rest } = pending.payload; // eslint-disable-line @typescript-eslint/no-unused-vars
          pending.payload = rest;
          pending.revision++;
          if (Object.keys(rest).length === 0) pending.done = true;
        }
      } else if (!(pending && 'Status' in pending.payload)) {
        outing.status = status;
      }
    }
  }

  async getOutingStatus(id: string) {
    return (this.rows('outings').find((r) => r.id === id)?.status as string | null | undefined) ?? null;
  }
}

export const title = (text: string) => ({ type: 'title', title: [{ plain_text: text }] });
export const text = (value: string) => ({ type: 'rich_text', rich_text: [{ plain_text: value }] });
export const select = (name: string | null) => ({ type: 'select', select: name ? { name } : null });
export const status = (name: string | null) => ({ type: 'status', status: name ? { name } : null });
export const multi = (...names: string[]) => ({ type: 'multi_select', multi_select: names.map((name) => ({ name })) });
export const relation = (...ids: string[]) => ({ type: 'relation', relation: ids.map((id) => ({ id })) });
export const date = (start: string | null, end: string | null = null) => ({
  type: 'date',
  date: start ? { start, end, time_zone: null } : null,
});
export const check = (value: boolean) => ({ type: 'checkbox', checkbox: value });
export const num = (value: number | null) => ({ type: 'number', number: value });
export const uid = (n: number) => ({ type: 'unique_id', unique_id: { prefix: null, number: n } });

export function page(id: string, properties: Record<string, unknown>, extra: Partial<NotionPage> = {}): NotionPage {
  return { id, last_edited_time: '2026-10-17T09:00:00.000Z', archived: false, in_trash: false, properties, ...extra };
}
