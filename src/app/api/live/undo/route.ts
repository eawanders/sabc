// POST /api/live/undo — undo your own change, if nobody has changed the row since (PER-276).
import { liveRoute } from '@/server/live/route';
import { undoSchema } from '@/lib/live/schemas';

export const POST = liveRoute('undo', undoSchema, async (i, ctx) => ({
  fn: 'undo_change',
  args: { p_change_id: i.changeId, p_actor: i.actorId, p_flag_status: await ctx.flagStatus() },
}));
