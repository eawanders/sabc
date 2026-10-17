// POST /api/live/unavailability — save a member's weekly unavailability (PER-276).
import { liveRoute } from '@/server/live/route';
import { saveUnavailabilitySchema } from '@/lib/live/schemas';

// Next to the database (Supabase, Ireland)
export const preferredRegion = 'dub1';

export const POST = liveRoute('unavailability', saveUnavailabilitySchema, (i) => ({
  fn: 'save_unavailability',
  args: {
    p_member_id: i.memberId,
    p_days: i.days,
    p_actor: i.actorId,
    p_expected_version: i.expectedVersion,
  },
}));
