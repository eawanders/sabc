// POST /api/sync/run — the per-minute sync tick, for a scheduler (pg_cron + pg_net).
// Header x-sync-secret must equal SYNC_SHARED_SECRET. ?full=1 runs a full
// inbound sweep (which also deletes rows whose Notion page has gone).
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSyncDb } from '@/server/sync/db';
import { syncAll } from '@/server/sync/inbound';
import { createSyncNotion } from '@/server/sync/notionApi';
import { runOutbox } from '@/server/sync/outbox';
import { timingSafeEqualStrings } from '@/server/sync/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Inbound gets the first 25 s, the outbox runs until 50 s, inside a 60 s function limit. */
const INBOUND_BUDGET_MS = 25_000;
const TOTAL_BUDGET_MS = 50_000;

export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_SHARED_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Sync is not configured' }, { status: 503 });
  }
  if (!timingSafeEqualStrings(req.headers.get('x-sync-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const full = req.nextUrl.searchParams.get('full') === '1';
  try {
    const db = createServiceRoleSyncDb();
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
