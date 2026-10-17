// POST /api/live/seat/swap — swap two seats (or move into an empty one), both or neither (PER-276).
import { liveRoute } from '@/server/live/route';
import { swapSeatsSchema } from '@/lib/live/schemas';

// Next to the database (Supabase, Ireland)
export const preferredRegion = 'dub1';

export const POST = liveRoute('seat/swap', swapSeatsSchema, async (i, ctx) => ({
  fn: 'swap_seats',
  args: {
    p_outing_id: i.outingId,
    p_seat_a: i.seatA,
    p_seat_b: i.seatB,
    p_actor: i.actorId,
    p_expected_version_a: i.expectedVersionA,
    p_expected_version_b: i.expectedVersionB,
    p_flag_status: await ctx.flagStatus(),
  },
}));
