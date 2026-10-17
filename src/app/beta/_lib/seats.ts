// Seat names as the database stores them (Notion relation names) and the labels the beta shows.

export const CREW_SEATS = ['Cox', 'Stroke', '7 Seat', '6 Seat', '5 Seat', '4 Seat', '3 Seat', '2 Seat', 'Bow'] as const;
export const SUB_SEATS = ['Sub 1', 'Sub 2', 'Sub 3', 'Sub 4'] as const;
export const BANK_RIDER = 'Coach/Bank Rider';

/** Drawer order: bank rider, the nine crew seats (cox to bow), then subs. */
export const SEAT_ORDER: readonly string[] = [BANK_RIDER, ...CREW_SEATS, ...SUB_SEATS];

const SHORT: Record<string, string> = {
  Cox: 'COX',
  Stroke: 'STR',
  Bow: 'BOW',
  [BANK_RIDER]: 'BR',
};

/** Monospace seat label: COX, STR, 7…2, BOW, S1–S4, BR. */
export function seatShort(seat: string): string {
  if (SHORT[seat]) return SHORT[seat];
  const n = /^(\d) Seat$/.exec(seat);
  if (n) return n[1];
  const sub = /^Sub (\d)$/.exec(seat);
  if (sub) return `S${sub[1]}`;
  return seat;
}

/** Seat name in a sentence ("changed 7 seat first"). */
export function seatLabel(seat: string): string {
  if (seat === BANK_RIDER) return 'Bank rider';
  const n = /^(\d) Seat$/.exec(seat);
  if (n) return `${n[1]} seat`;
  return seat;
}

export function isCrewSeat(seat: string): boolean {
  return (CREW_SEATS as readonly string[]).includes(seat);
}

/** Seat statuses as the keyboard sets them (1/2/3). */
export const KEY_STATUS: Record<'1' | '2' | '3', string> = {
  '1': 'Available',
  '2': 'Maybe Available',
  '3': 'Not Available',
};

export type StatusTone = 'ok' | 'maybe' | 'no' | 'unk';

/** Colour is for state only: a dot plus a short word. */
export function statusDisplay(status: string | null | undefined): { tone: StatusTone; text: string } {
  switch (status) {
    case 'Available':
      return { tone: 'ok', text: 'Available' };
    case 'Maybe Available':
      return { tone: 'maybe', text: 'Maybe' };
    case 'Not Available':
      return { tone: 'no', text: "Can't" };
    case 'Reserved':
      return { tone: 'unk', text: 'Reserved' };
    default:
      return { tone: 'unk', text: 'Awaiting' };
  }
}

export function outingStatusTone(status: string | null | undefined): StatusTone {
  if (status === 'Confirmed') return 'ok';
  if (status === 'Cancelled') return 'no';
  if (status === 'Provisional') return 'maybe';
  return 'unk';
}

/** River flag → tone. Green is fine; red/black means no crews out. */
export function flagTone(flag: string | null | undefined): StatusTone {
  const f = (flag ?? '').toLowerCase();
  if (!f) return 'unk';
  if (f.includes('green')) return 'ok';
  if (f.includes('red') || f.includes('black')) return 'no';
  return 'maybe';
}
