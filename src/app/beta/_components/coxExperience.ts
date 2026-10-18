// Browser-side, read-only: members' cox experience (Notion "Cox Experience"), loaded once per page
// session for the crew drawer's cox rules. Kept apart from the shared directory so its shape stays.
import { getBrowserClient } from '@/lib/live/realtime';

let cache: Promise<Record<string, string>> | null = null;

export function loadCoxExperience(): Promise<Record<string, string>> {
  if (!cache) {
    cache = (async () => {
      const client = getBrowserClient();
      if (!client) return {};
      const { data, error } = await client.from('members').select('id, cox_experience').not('cox_experience', 'is', null);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).map((m) => [m.id as string, m.cox_experience as string]));
    })();
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}
