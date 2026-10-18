// src/server/live/guestMember.ts
// Server-only: add a guest (Non-Member) so they can be seated straight away (PER-277).
// Dedupe first against the members table (audit A15), then create the Notion page and upsert
// the row into Postgres at once, so the seat FK (outing_seats.member_id -> members.id) holds
// before the next inbound sync.
import type { SupabaseClient } from '@supabase/supabase-js';
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

export async function addGuest(
  name: string,
  deps: { db?: SupabaseClient; createPage?: (name: string) => Promise<string> } = {},
): Promise<AddGuestResult> {
  const db = deps.db ?? getServiceClient();
  const clean = normaliseName(name);
  const existing = await findMemberByName(db, clean);
  if (existing) return { member: existing, created: false };
  const id = await (deps.createPage ?? createNotionGuest)(clean);
  const member = { id, name: clean };
  await upsertGuestRow(db, member);
  return { member, created: true };
}
