// POST /api/live/seat/claim — put a member in a seat (or clear it); first claim wins (PER-276).
import { liveRoute } from '@/server/live/route';
import { claimSeatSchema } from '@/lib/live/schemas';

// Next to the database (Supabase, Ireland)
export const preferredRegion = 'dub1';

export const POST = liveRoute('seat/claim', claimSeatSchema, async (i, ctx) => ({
  fn: 'claim_seat',
  args: {
    p_outing_id: i.outingId,
    p_seat: i.seat,
    p_member_id: i.memberId,
    p_status: i.status ?? null,
    p_actor: i.actorId,
    p_expected_version: i.expectedVersion,
    p_flag_status: await ctx.flagStatus(),
  },
}));
