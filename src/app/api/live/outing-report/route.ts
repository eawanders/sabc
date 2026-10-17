// POST /api/live/outing-report — save an outing report; only the fields sent are changed (PER-276).
import { liveRoute } from '@/server/live/route';
import { saveOutingReportSchema } from '@/lib/live/schemas';

// Next to the database (Supabase, Ireland)
export const preferredRegion = 'dub1';

const COLUMNS = {
  outingSummary: 'outing_summary',
  boatFeel: 'boat_feel',
  outingSuccesses: 'outing_successes',
  nextFocus: 'next_focus',
  coachFeedback: 'coach_feedback',
} as const;

export const POST = liveRoute('outing-report', saveOutingReportSchema, (i) => {
  const fields: Record<string, string | null> = {};
  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = i.fields[key as keyof typeof COLUMNS];
    if (value !== undefined) fields[column] = value;
  }
  return {
    fn: 'save_outing_report',
    args: { p_outing_id: i.outingId, p_fields: fields, p_actor: i.actorId, p_expected_version: i.expectedVersion },
  };
});
