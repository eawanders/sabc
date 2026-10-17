// Toast wording for seat writes.
import type { LiveConflict, SeatRow } from '@/lib/live/types';
import { seatLabel } from './seats';

export function conflictMessage(seat: string, conflict: Pick<LiveConflict<SeatRow>, 'holderName' | 'updatedByName' | 'heldSeat' | 'message'>): string {
  if (conflict.heldSeat) {
    return `${conflict.holderName ?? 'They'} ${conflict.holderName ? 'is' : 'are'} already in ${seatLabel(conflict.heldSeat)}. Yours wasn't applied.`;
  }
  const who = conflict.updatedByName ?? 'Someone';
  return `${who} changed ${seatLabel(seat)} first (now ${conflict.holderName ?? 'empty'}). Yours wasn't applied.`;
}

export function changeMessage(seat: string, change: { memberName?: string | null; cleared?: boolean; status?: string }): string {
  if (change.cleared) return `Cleared ${seatLabel(seat)}`;
  if (change.memberName) return `${change.memberName} → ${seatLabel(seat)}`;
  return `${seatLabel(seat)} → ${change.status === 'Maybe Available' ? 'Maybe' : change.status === 'Not Available' ? "Can't" : change.status}`;
}
