// src/lib/seatProperties.ts
// Notion property names for each seat, keyed by the seat names the outing drawer sends.

export const SEAT_PROPERTIES: Record<string, { relation: string; status: string }> = {
  'Cox': { relation: 'Cox', status: 'Cox Status' },
  'Stroke': { relation: 'Stroke', status: 'Stroke Status' },
  '7 Seat': { relation: '7 Seat', status: '7 Seat Status' },
  '6 Seat': { relation: '6 Seat', status: '6 Seat Status' },
  '5 Seat': { relation: '5 Seat', status: '5 Seat Status' },
  '4 Seat': { relation: '4 Seat', status: '4 Seat Status' },
  '3 Seat': { relation: '3 Seat', status: '3 Seat Status' },
  '2 Seat': { relation: '2 Seat', status: '2 Seat Status' },
  'Bow': { relation: 'Bow', status: 'Bow Status' },
  'Coach/Bank Rider': { relation: 'Coach/Bank Rider', status: 'Bank Rider Status' },
  'Sub1': { relation: 'Sub 1', status: 'Sub 1 Status' },
  'Sub2': { relation: 'Sub 2', status: 'Sub 2 Status' },
  'Sub3': { relation: 'Sub 3', status: 'Sub 3 Status' },
  'Sub4': { relation: 'Sub 4', status: 'Sub 4 Status' },
};

// Values of the "<seat> Status" Notion status properties
export const SEAT_STATUSES = ['Available', 'Maybe Available', 'Not Available', 'Awaiting Approval', 'Reserved'];

export function isSeatStatus(value: unknown): value is string {
  return typeof value === 'string' && SEAT_STATUSES.includes(value);
}
