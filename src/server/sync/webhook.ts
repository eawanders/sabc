// Notion integration webhooks.
//
// - Handshake: when a subscription is created Notion POSTs {"verification_token": "..."}
//   once, unsigned. That token is pasted back into Notion's UI to verify the
//   subscription, and is also the HMAC key for every later event.
// - Events: X-Notion-Signature: sha256=<hex HMAC-SHA256 of the raw body, keyed
//   with the verification token>.
// Docs: https://developers.notion.com/reference/webhooks
import { createHmac, timingSafeEqual } from 'node:crypto';
import { sourceForParent, type SourceDef } from './sources';

export function verifyNotionSignature(rawBody: string, header: string | null, token: string): boolean {
  if (!header || !token) return false;
  const expected = `sha256=${createHmac('sha256', token).update(rawBody).digest('hex')}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function timingSafeEqualStrings(given: string | null, expected: string): boolean {
  if (given === null || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface WebhookEvent {
  type?: string;
  entity?: { id?: string; type?: string };
  data?: { parent?: { id?: string; type?: string; data_source_id?: string } };
}

export type WebhookAction =
  | { kind: 'reconcile-page'; source: SourceDef; pageId: string }
  | { kind: 'sync-source'; source: SourceDef }
  | { kind: 'ignore'; reason: string };

/**
 * What an event asks for. Page deletes/undeletes re-read that one page (an
 * incremental query never returns trashed pages); every other change to a page
 * in a synced data source triggers an incremental sync of that source.
 */
export function planWebhookEvent(event: WebhookEvent): WebhookAction {
  const type = event.type ?? '';
  if (type.startsWith('page.')) {
    const parent = event.data?.parent;
    const source = sourceForParent(parent?.data_source_id, parent?.id);
    if (!source) return { kind: 'ignore', reason: 'page outside the synced data sources' };
    if (type === 'page.deleted' || type === 'page.undeleted') {
      if (!event.entity?.id) return { kind: 'ignore', reason: 'no page id' };
      return { kind: 'reconcile-page', source, pageId: event.entity.id };
    }
    if (type === 'page.content_updated' || type === 'page.locked' || type === 'page.unlocked') {
      return { kind: 'ignore', reason: `${type} does not change synced properties` };
    }
    return { kind: 'sync-source', source };
  }
  if (type.startsWith('data_source.') || type.startsWith('database.')) {
    const source = sourceForParent(event.entity?.id);
    return source ? { kind: 'sync-source', source } : { kind: 'ignore', reason: 'unsynced data source' };
  }
  return { kind: 'ignore', reason: `unhandled event ${type || '(none)'}` };
}

/** Webhook-triggered syncs of one source run at most this often; the per-minute run catches the rest. */
export const WEBHOOK_DEBOUNCE_MS = 15_000;

export function isDebounced(lastRunAt: string | null, now: number, windowMs = WEBHOOK_DEBOUNCE_MS): boolean {
  return lastRunAt !== null && now - Date.parse(lastRunAt) < windowMs;
}
