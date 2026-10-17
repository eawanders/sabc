// src/lib/live/members.ts
// STUB (PER-277, beta swim tests). The real helper — POST /api/live/member/add — is being built in
// a parallel PR; this file only fixes the signature so callers compile. Replace it with that PR's
// version when it lands (keep the signature).
export type AddGuestMemberResult =
  | { ok: true; member: { id: string; name: string } }
  | { ok: false; reason: string };

export async function addGuestMember(input: { name: string; actor: string }): Promise<AddGuestMemberResult> {
  void input;
  throw new Error('not available yet');
}
