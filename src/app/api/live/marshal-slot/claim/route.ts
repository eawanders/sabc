// POST /api/live/marshal-slot/claim — sign up for (or clear) a marshal slot; first claim wins (PER-276).
import { liveRoute } from '@/server/live/route';
import { claimMarshalSlotSchema } from '@/lib/live/schemas';

// Next to the database (Supabase, Ireland)
export const preferredRegion = 'dub1';

export const POST = liveRoute('marshal-slot/claim', claimMarshalSlotSchema, (i) => ({
  fn: 'claim_marshal_slot',
  args: {
    p_slot_id: i.slotId,
    p_member_id: i.memberId,
    p_actor: i.actorId,
    p_expected_version: i.expectedVersion,
  },
}));
