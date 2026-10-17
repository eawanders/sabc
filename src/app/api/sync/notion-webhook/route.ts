// POST /api/sync/notion-webhook — Notion integration webhook receiver.
// Verifies X-Notion-Signature, answers 200 at once, and applies the event after
// the response (next/server `after`): a page delete/undelete re-reads that page,
// any other change runs an incremental sync of its data source, debounced.
import { after, NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSyncDb } from '@/server/sync/db';
import { reconcilePage, syncSource } from '@/server/sync/inbound';
import { createSyncNotion } from '@/server/sync/notionApi';
import { isDebounced, planWebhookEvent, verifyNotionSignature, type WebhookAction } from '@/server/sync/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  const signature = req.headers.get('x-notion-signature');

  // One-time handshake. Stored server-side (never logged) for Edward to copy
  // into Notion and into NOTION_WEBHOOK_VERIFICATION_TOKEN. Once that env var
  // is set, further handshakes are ignored.
  if (typeof body.verification_token === 'string' && !signature) {
    if (token) return NextResponse.json({ ok: true, ignored: 'already verified' });
    if (body.verification_token.length > 200) {
      return NextResponse.json({ error: 'Invalid verification token' }, { status: 400 });
    }
    await createServiceRoleSyncDb().saveWebhookToken(body.verification_token);
    return NextResponse.json({ ok: true });
  }

  if (!token) {
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 });
  }
  if (!verifyNotionSignature(raw, signature, token)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const action = planWebhookEvent(body);
  if (action.kind === 'ignore') {
    return NextResponse.json({ ok: true, ignored: action.reason });
  }
  after(() => applyWebhookAction(action));
  return NextResponse.json({ ok: true, accepted: action.kind, source: action.source.key });
}

async function applyWebhookAction(action: Exclude<WebhookAction, { kind: 'ignore' }>) {
  try {
    const db = createServiceRoleSyncDb();
    const notion = createSyncNotion();
    if (action.kind === 'reconcile-page') {
      await reconcilePage(notion, db, action.source, action.pageId);
      return;
    }
    const state = await db.getState(action.source.key);
    if (isDebounced(state.last_run_at, Date.now())) return;
    await syncSource(notion, db, action.source, { deadline: Date.now() + 20_000 });
  } catch (error) {
    console.error('[sync/notion-webhook] failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}
