// POST /api/live/test-slot/outcome — set a swim-test slot's outcome; conflict if its member changed (PER-276).
import { liveRoute } from '@/server/live/route';
import { setTestOutcomeSchema } from '@/lib/live/schemas';

export const POST = liveRoute('test-slot/outcome', setTestOutcomeSchema, (i) => ({
  fn: 'set_test_outcome',
  args: {
    p_test_id: i.testId,
    p_slot: i.slot,
    p_outcome: i.outcome,
    p_actor: i.actorId,
    p_expected_member_id: i.expectedMemberId,
  },
}));
