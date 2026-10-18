// Toast wording for swim-test slot writes.
import type { LiveConflict, TestSlotRow } from '@/lib/live/types';
import type { Lost } from './tests-state';

type Conflict = Pick<LiveConflict<TestSlotRow>, 'current' | 'holderName' | 'updatedByName' | 'heldSlot'>;

export function slotLabel(slot: number): string {
  return `Slot ${slot}`;
}

/** A claim lost the race: say who has the slot now. */
export function takenMessage(slot: number, c: Conflict): string {
  if (c.heldSlot) return `${c.holderName ?? 'They'} ${c.holderName ? 'is' : 'are'} already in ${slotLabel(c.heldSlot)}. Yours wasn't applied.`;
  if (c.current?.member_id) return `${slotLabel(slot)} was taken by ${c.holderName ?? 'someone'} first. Yours wasn't applied.`;
  return `${c.updatedByName ?? 'Someone'} changed ${slotLabel(slot)} first (now empty). Yours wasn't applied.`;
}

/** An outcome change lost: the slot's member changed underneath it. */
export function outcomeConflictMessage(slot: number, c: Conflict): string {
  return `${c.updatedByName ?? 'Someone'} changed ${slotLabel(slot)} first (now ${c.holderName ?? 'empty'}). Outcome not saved.`;
}

export function slotChangeMessage(slot: number, change: { memberName?: string | null; cleared?: boolean; outcome?: string }): string {
  if (change.cleared) return `Cleared ${slotLabel(slot)}`;
  if (change.memberName) return `${change.memberName} → ${slotLabel(slot)}`;
  return `${slotLabel(slot)} → ${change.outcome}`;
}

function lostText(lost: Lost[]): string {
  return lost.map((l) => `${slotLabel(l.slot)} went to ${l.holderName ?? 'someone'}`).join(', ');
}

export function bookedMessage(slot: number, lost: Lost[]): string {
  return lost.length ? `Booked you in ${slotLabel(slot)} (${lostText(lost)} first)` : `Booked you in ${slotLabel(slot)}`;
}

export function fullMessage(lost: Lost[]): string {
  const last = lost[lost.length - 1];
  return last ? `Full: ${last.holderName ?? 'someone'} took the last slot first.` : 'Full: no free slots left.';
}
