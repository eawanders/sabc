// POST /api/sync/run — the per-minute sync tick, for a scheduler (pg_cron + pg_net).
// Header x-sync-secret must equal the Supabase Vault secret 'sync_shared_secret'
// (checked in the database, so the value never has to be copied anywhere). ?full=1 runs a full
// inbound sweep (which also deletes rows whose Notion page has gone).
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSyncDb } from '@/server/sync/db';
import { syncAll } from '@/server/sync/inbound';
import { createSyncNotion } from '@/server/sync/notionApi';
import { runOutbox } from '@/server/sync/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Inbound gets the first 25 s, the outbox runs until 50 s, inside a 60 s function limit. */
const INBOUND_BUDGET_MS = 25_000;
const TOTAL_BUDGET_MS = 50_000;

export async function POST(req: NextRequest) {
  const provided = req.headers.get('x-sync-secret');
  if (!provided) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = createServiceRoleSyncDb();
  if (!(await db.verifySyncSecret(provided))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const full = req.nextUrl.searchParams.get('full') === '1';
  try {
    const notion = createSyncNotion();
    const inbound = await syncAll(notion, db, { full, deadline: started + INBOUND_BUDGET_MS });
    const outbox = await runOutbox(notion, db, { deadline: started + TOTAL_BUDGET_MS });
    const ok = inbound.every((r) => !r.error);
    return NextResponse.json({ ok, full, inbound, outbox, ms: Date.now() - started }, { status: ok ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sync/run] failed:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
