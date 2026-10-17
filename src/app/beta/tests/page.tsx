// /beta/tests?when=past&type=swim|capsize&test=<id>: swim tests and capsize drills, rendered on the
// server with the anon key; the slot drawer for ?test= opens on the client and updates live.
import type { TestSlotRow } from '@/lib/live/types';
import { anonClient } from '../_lib/week';
import { loadTests, parseWhen, type BetaTest } from '../_lib/tests-data';
import { TestsClient } from './TestsClient';
import './tests.css';

export const dynamic = 'force-dynamic';
// The database is in Ireland
export const preferredRegion = 'dub1';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BetaTests({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const when = parseWhen(sp.when);

  let tests: BetaTest[] = [];
  let slots: TestSlotRow[] = [];
  let error: string | null = null;
  const client = anonClient();
  if (!client) {
    error = 'Supabase is not configured for this deployment.';
  } else {
    try {
      ({ tests, slots } = await loadTests(client, when));
    } catch {
      error = "Couldn't load tests. Refresh to try again.";
    }
  }

  return <TestsClient when={when} tests={tests} slots={slots} error={error} />;
}
