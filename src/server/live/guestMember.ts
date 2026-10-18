// src/server/live/guestMember.ts
// Server-only: add a guest (Non-Member) so they can be seated straight away (PER-277).
// Dedupe first against the members table (audit A15), then create the Notion page and upsert
// the row into Postgres at once, so the seat FK (outing_seats.member_id -> members.id) holds
// before the next inbound sync.
// Two simultaneous adds of one new name would both miss the lookup and create two Notion pages,
// so the create path first claims the name in Postgres (claim_guest_name, PER-278): the winner
// creates, the other waits for it and gets the same member. If the claim RPC is unavailable
// (e.g. before its migration lands) the add goes ahead unguarded, as it did before.
import type { SupabaseClient } from '@supabase/supabase-js';
import logger from '@/app/api/_utils/logger';
import { getNotionClient } from '@/server/notion/client';
import { SOURCES, canonicalId } from '@/server/sync/sources';
import { getServiceClient } from './client';

export type GuestMember = { id: string; name: string };

const MEMBERS = SOURCES.find((s) => s.key === 'members')!;

/** Trim and collapse inner whitespace: the form names are compared and stored in. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** An existing member with this name, compared case-insensitively after normalising. */
export async function findMemberByName(db: SupabaseClient, name: string): Promise<GuestMember | null> {
  const wanted = normaliseName(name).toLowerCase();
  // ilike narrows the scan: a case-insensitive match with % and _ escaped, and `%` between words
  // so a stored name with different inner spacing still comes back; the exact comparison decides.
  const pattern = wanted
    .split(' ')
    .map((w) => w.replace(/[\\%_]/g, (c) => `\\${c}`))
    .join('%');
  const { data, error } = await db.from('members').select('id, name').ilike('name', pattern).limit(50);
  if (error) throw new Error(`members lookup failed: ${error.message}`);
  const hit = (data ?? []).find((m) => normaliseName(String(m.name)).toLowerCase() === wanted);
  return hit ? { id: String(hit.id), name: String(hit.name) } : null;
}

/** Create the Notion page in the Members data source; returns its canonical id. */
export async function createNotionGuest(name: string): Promise<string> {
  const page = await getNotionClient().request<{ id: string }>({
    method: 'post',
    path: 'pages',
    body: {
      parent: { type: 'data_source_id', data_source_id: MEMBERS.dataSourceId },
      properties: {
        'Full Name': { title: [{ text: { content: name } }] },
        'Member Type': { multi_select: [{ name: 'Non-Member' }] },
      },
    },
  });
  return canonicalId(page.id);
}

export async function upsertGuestRow(db: SupabaseClient, member: GuestMember): Promise<void> {
  const { error } = await db.from('members').upsert(
    { id: member.id, name: member.name, member_type: ['Non-Member'], synced_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`members upsert failed: ${error.message}`);
}

export type AddGuestResult = { member: GuestMember; created: boolean };

/** Another add of the same name is still creating it after we waited: the caller should retry. */
export class GuestPendingError extends Error {
  constructor() {
    super('Another add of this guest is in progress');
    this.name = 'GuestPendingError';
  }
}

type Claim =
  | { status: 'claimed'; token: string }
  | { status: 'exists'; member_id: string; name: string }
  | { status: 'pending' }
  | { status: 'invalid' };

const POLL_MS = 250;
const POLL_TRIES = 20; // ~5 s: a Notion page create takes about a second

/** Claim the name; null when the claim RPC can't be used (the add then goes ahead unguarded). */
async function claimName(db: SupabaseClient, name: string): Promise<Claim | null> {
  try {
    const { data, error } = await db.rpc('claim_guest_name', { p_name: name });
    if (error) throw new Error(error.message);
    return data as Claim;
  } catch (error) {
    logger.warn({ type: 'GUEST_CLAIM_UNAVAILABLE', error: error instanceof Error ? error.message : 'unknown' });
    return null;
  }
}

/** Best effort: a lost finish/release only means the claim lapses after a minute. */
async function settleClaim(db: SupabaseClient, fn: 'finish_guest_claim' | 'release_guest_claim', args: Record<string, string>) {
  try {
    const { error } = await db.rpc(fn, args);
    if (error) throw new Error(error.message);
  } catch (error) {
    logger.warn({ type: 'GUEST_CLAIM_UNAVAILABLE', fn, error: error instanceof Error ? error.message : 'unknown' });
  }
}

async function create(
  db: SupabaseClient,
  name: string,
  createPage: (name: string) => Promise<string>,
): Promise<AddGuestResult> {
  const member = { id: await createPage(name), name };
  await upsertGuestRow(db, member);
  return { member, created: true };
}

/** We hold the claim: create the guest, then record it so concurrent adds get the same member. */
async function createClaimed(
  db: SupabaseClient,
  name: string,
  token: string,
  createPage: (name: string) => Promise<string>,
): Promise<AddGuestResult> {
  let pageCreated = false;
  try {
    // A previous holder may have created the row and died before finishing its claim
    const existing = await findMemberByName(db, name);
    const result = existing
      ? { member: existing, created: false }
      : await create(db, name, async (n) => {
          const id = await createPage(n);
          pageCreated = true;
          return id;
        });
    await settleClaim(db, 'finish_guest_claim', { p_name: name, p_token: token, p_member_id: result.member.id });
    return result;
  } catch (error) {
    // No page made: free the name so a retry can go at once. A page made but not stored keeps the
    // claim until it lapses, rather than inviting a second page straight away.
    if (!pageCreated) await settleClaim(db, 'release_guest_claim', { p_name: name, p_token: token });
    throw error;
  }
}

export async function addGuest(
  name: string,
  deps: { db?: SupabaseClient; createPage?: (name: string) => Promise<string> } = {},
): Promise<AddGuestResult> {
  const db = deps.db ?? getServiceClient();
  const createPage = deps.createPage ?? createNotionGuest;
  const clean = normaliseName(name);
  const existing = await findMemberByName(db, clean);
  if (existing) return { member: existing, created: false };

  for (let attempt = 0; ; attempt++) {
    const claim = await claimName(db, clean);
    if (!claim || claim.status === 'invalid') return create(db, clean, createPage);
    if (claim.status === 'claimed') return createClaimed(db, clean, claim.token, createPage);
    if (claim.status === 'exists') return { member: { id: claim.member_id, name: claim.name }, created: false };
    if (attempt + 1 >= POLL_TRIES) throw new GuestPendingError();
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}
