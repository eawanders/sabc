// POST /api/live/seat/status — change a seat's status; conflict if the seat's member changed (PER-276).
import { liveRoute } from '@/server/live/route';
import { setSeatStatusSchema } from '@/lib/live/schemas';

// Next to the database (Supabase, Ireland)
export const preferredRegion = 'dub1';

export const POST = liveRoute('seat/status', setSeatStatusSchema, async (i, ctx) => ({
  fn: 'set_seat_status',
  args: {
    p_outing_id: i.outingId,
    p_seat: i.seat,
    p_status: i.status,
    p_actor: i.actorId,
    p_expected_member_id: i.expectedMemberId,
    p_flag_status: await ctx.flagStatus(),
  },
}));
