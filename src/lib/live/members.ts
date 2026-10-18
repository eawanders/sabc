// src/lib/live/members.ts
// Browser-side: add a guest (Non-Member) who can be seated at once (PER-277). Never throws.
// If a member of that name already exists (case-insensitive) it is returned instead of a duplicate.
// On failure `reason` is a short sentence safe to show the user.

export type AddGuestMemberResult =
  | { ok: true; member: { id: string; name: string } }
  | { ok: false; reason: string };

export async function addGuestMember(
  { name, actor }: { name: string; actor: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<AddGuestMemberResult> {
  let res: Response;
  try {
    res = await fetchImpl('/api/live/member/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, actor }),
    });
  } catch {
    return { ok: false, reason: 'Could not reach the server' };
  }
  const json = (await res.json().catch(() => null)) as Partial<AddGuestMemberResult> | null;
  if (json?.ok === true && json.member && typeof json.member.id === 'string') {
    return { ok: true, member: { id: json.member.id, name: String(json.member.name) } };
  }
  if (json?.ok === false && typeof json.reason === 'string') return { ok: false, reason: json.reason };
  return { ok: false, reason: res.status === 429 ? 'Too many changes, try again in a moment' : 'Could not add the guest' };
}
