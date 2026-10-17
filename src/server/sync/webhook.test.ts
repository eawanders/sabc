import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isDebounced, planWebhookEvent, timingSafeEqualStrings, verifyNotionSignature } from './webhook';

const TOKEN = 'secret_test_token';
const body = JSON.stringify({ type: 'page.properties_updated', entity: { id: 'x', type: 'page' } });
const sign = (raw: string, key = TOKEN) => `sha256=${createHmac('sha256', key).update(raw).digest('hex')}`;

describe('verifyNotionSignature', () => {
  it('accepts the HMAC-SHA256 of the raw body keyed with the verification token', () => {
    expect(verifyNotionSignature(body, sign(body), TOKEN)).toBe(true);
  });

  it('rejects a wrong key, a tampered body, a missing header or a missing token', () => {
    expect(verifyNotionSignature(body, sign(body, 'other'), TOKEN)).toBe(false);
    expect(verifyNotionSignature(body + ' ', sign(body), TOKEN)).toBe(false);
    expect(verifyNotionSignature(body, null, TOKEN)).toBe(false);
    expect(verifyNotionSignature(body, sign(body), '')).toBe(false);
    expect(verifyNotionSignature(body, 'sha256=short', TOKEN)).toBe(false);
  });
});

describe('timingSafeEqualStrings', () => {
  it('matches only the exact secret', () => {
    expect(timingSafeEqualStrings('s3cret', 's3cret')).toBe(true);
    expect(timingSafeEqualStrings('s3cre', 's3cret')).toBe(false);
    expect(timingSafeEqualStrings(null, 's3cret')).toBe(false);
    expect(timingSafeEqualStrings('', '')).toBe(false);
  });
});

describe('planWebhookEvent', () => {
  const outingsParent = { id: '23d80040-a8fa-80ed-afaf-f6c83477d5d0', type: 'database', data_source_id: '23d80040-a8fa-80e1-a538-000bc51d1f0d' };

  it('syncs the parent data source on a property change', () => {
    const action = planWebhookEvent({ type: 'page.properties_updated', entity: { id: 'p' }, data: { parent: outingsParent } });
    expect(action).toMatchObject({ kind: 'sync-source', source: { key: 'outings' } });
  });

  it('re-reads the page on delete and undelete', () => {
    for (const type of ['page.deleted', 'page.undeleted']) {
      expect(planWebhookEvent({ type, entity: { id: 'p1' }, data: { parent: outingsParent } })).toMatchObject({
        kind: 'reconcile-page',
        pageId: 'p1',
        source: { key: 'outings' },
      });
    }
  });

  it('ignores pages outside the synced data sources and body-only edits', () => {
    expect(planWebhookEvent({ type: 'page.created', data: { parent: { id: '0ef104cd-477e-80e1-8571-cfd10e92339a', type: 'page' } } }).kind).toBe('ignore');
    expect(planWebhookEvent({ type: 'page.content_updated', data: { parent: outingsParent } }).kind).toBe('ignore');
    expect(planWebhookEvent({ type: 'comment.created' }).kind).toBe('ignore');
  });
});

describe('isDebounced', () => {
  it('skips a webhook sync within 15 s of the last run', () => {
    const now = Date.parse('2026-10-17T12:00:00Z');
    expect(isDebounced('2026-10-17T11:59:50Z', now)).toBe(true);
    expect(isDebounced('2026-10-17T11:59:40Z', now)).toBe(false);
    expect(isDebounced(null, now)).toBe(false);
  });
});
