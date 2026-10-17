// src/lib/live/schemas.ts
// Request bodies of the /api/live/* routes. Browser-safe (zod only), so callers get the input types.
import { z } from 'zod';
import { notionPageIdSchema } from '@/app/api/_utils/schemas';
import { SEAT_PROPERTIES, isSeatStatus } from '@/lib/seatProperties';
import { validateWeeklyAvailability, type DayOfWeek } from '@/types/rowerAvailability';

/** Notion page ids arrive as 32 hex or hyphenated, any case; the database stores lower-case hyphenated. */
export function toCanonicalId(id: string): string {
  const hex = id.replace(/-/g, '').toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const id = notionPageIdSchema.transform(toCanonicalId);

// The drawer's seat names ('Sub1', ...) map to the Notion relation names the database uses ('Sub 1');
// those names are accepted as they are too.
const DB_SEATS = new Set(Object.values(SEAT_PROPERTIES).map((p) => p.relation));
export function toDbSeat(seat: string): string | undefined {
  if (Object.hasOwn(SEAT_PROPERTIES, seat)) return SEAT_PROPERTIES[seat].relation;
  return DB_SEATS.has(seat) ? seat : undefined;
}
const seat = z
  .string()
  .max(32)
  .transform((value, ctx) => {
    const mapped = toDbSeat(value);
    if (!mapped) {
      ctx.addIssue({ code: 'custom', message: 'Unknown seat' });
      return z.NEVER;
    }
    return mapped;
  });
const seatStatus = z.string().refine(isSeatStatus, 'Unknown seat status');
const version = z.number().int().min(0);
const slot = z.number().int().min(1).max(6);

export const claimSeatSchema = z
  .object({
    outingId: id,
    seat,
    memberId: id.nullable(),
    status: seatStatus.nullable().optional(), // omitted / null: leave the seat's status as it is
    actorId: id,
    expectedVersion: version,
  })
  .strict();

export const setSeatStatusSchema = z
  .object({
    outingId: id,
    seat,
    status: seatStatus,
    actorId: id,
    expectedMemberId: id.nullable(), // who the client saw in the seat (null: empty)
  })
  .strict();

export const swapSeatsSchema = z
  .object({
    outingId: id,
    seatA: seat,
    seatB: seat,
    actorId: id,
    expectedVersionA: version,
    expectedVersionB: version,
  })
  .strict();

export const claimTestSlotSchema = z
  .object({ testId: id, slot, memberId: id.nullable(), actorId: id, expectedVersion: version })
  .strict();

export const setTestOutcomeSchema = z
  .object({
    testId: id,
    slot,
    outcome: z.enum(['No Show', 'Test Booked', 'Failed', 'Passed']),
    actorId: id,
    expectedMemberId: id.nullable(),
  })
  .strict();

export const claimMarshalSlotSchema = z
  .object({ slotId: id, memberId: id.nullable(), actorId: id, expectedVersion: version })
  .strict();

const timeRange = z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) }).strict();
const day = z.array(timeRange).max(3);
export const saveUnavailabilitySchema = z
  .object({
    memberId: id,
    days: z
      .object({ monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day, sunday: day })
      .strict()
      // Same rules as /api/update-rower-availability: valid times, end after start, no overlaps
      .superRefine((days, ctx) => {
        const { errors } = validateWeeklyAvailability(days);
        for (const [d, message] of Object.entries(errors)) {
          ctx.addIssue({ code: 'custom', path: [d as DayOfWeek], message });
        }
      }),
    actorId: id,
    expectedVersion: version,
  })
  .strict();

// A Notion rich_text text object holds at most 2000 characters
const reportText = z.string().max(2000).nullable().optional();
export const saveOutingReportSchema = z
  .object({
    outingId: id,
    fields: z
      .object({
        outingSummary: reportText,
        boatFeel: reportText,
        outingSuccesses: reportText,
        nextFocus: reportText,
        coachFeedback: reportText,
      })
      .strict(),
    actorId: id,
    expectedVersion: version,
  })
  .strict();

export const undoSchema = z.object({ changeId: z.number().int().positive(), actorId: id }).strict();

export type ClaimSeatInput = z.input<typeof claimSeatSchema>;
export type SetSeatStatusInput = z.input<typeof setSeatStatusSchema>;
export type SwapSeatsInput = z.input<typeof swapSeatsSchema>;
export type ClaimTestSlotInput = z.input<typeof claimTestSlotSchema>;
export type SetTestOutcomeInput = z.input<typeof setTestOutcomeSchema>;
export type ClaimMarshalSlotInput = z.input<typeof claimMarshalSlotSchema>;
export type SaveUnavailabilityInput = z.input<typeof saveUnavailabilitySchema>;
export type SaveOutingReportInput = z.input<typeof saveOutingReportSchema>;
export type UndoInput = z.input<typeof undoSchema>;
