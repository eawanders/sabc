// src/lib/live/identity.ts
// "Pick your name once": the member id this device writes as, kept in localStorage (PER-276).
// It is an identity, not authentication; the server only checks the id is a member.
import { isNotionPageId } from '@/app/api/_utils/schemas';

const KEY = 'sabc.live.actorId';

export function getStoredActorId(): string | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return isNotionPageId(value) ? value : null;
  } catch {
    return null; // private mode, blocked storage, or server render
  }
}

export function storeActorId(memberId: string): void {
  if (!isNotionPageId(memberId)) throw new Error('Not a member id');
  try {
    window.localStorage.setItem(KEY, memberId);
  } catch {
    // Storage unavailable: the choice is not remembered
  }
}

export function clearStoredActorId(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing stored
  }
}
