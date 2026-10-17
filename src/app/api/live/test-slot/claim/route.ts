// POST /api/live/test-slot/claim — book (or clear) a swim-test slot; first claim wins (PER-276).
import { liveRoute } from '@/server/live/route';
import { claimTestSlotSchema } from '@/lib/live/schemas';

export const POST = liveRoute('test-slot/claim', claimTestSlotSchema, (i) => ({
  fn: 'claim_test_slot',
  args: {
    p_test_id: i.testId,
    p_slot: i.slot,
    p_member_id: i.memberId,
    p_actor: i.actorId,
    p_expected_version: i.expectedVersion,
  },
}));
