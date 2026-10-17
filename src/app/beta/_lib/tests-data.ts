// Swim tests and capsize drills for /beta/tests: definitions (synced from Notion) and their slots,
// read with the anon key (RLS: public read), so this is safe on the server and in the browser.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TestSlotRow } from '@/lib/live/types';
import { londonParts, londonToUtc } from './time';

export type BetaTest = {
  id: string;
  title: string;
  type: string | null; // 'Swim Test' | 'Capsize Drill' in practice; unchecked in the database
  available_slots: number;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
};

export type TestsWhen = 'upcoming' | 'past';
export type TestsType = 'all' | 'swim' | 'capsize';

export const TEST_COLUMNS = 'id, title, type, available_slots, start_at, end_at, all_day';

/** Midnight (London) at the start of `now`'s day: today's tests still count as upcoming. */
export function startOfLondonDay(now: Date): Date {
  const p = londonParts(now);
  return londonToUtc(p.y, p.m, p.d);
}

const PAST_LIMIT = 200;

/** Upcoming tests oldest first, or past tests newest first, with all their slot rows. */
export async function loadTests(
  client: SupabaseClient,
  when: TestsWhen,
  now: Date = new Date(),
): Promise<{ tests: BetaTest[]; slots: TestSlotRow[] }> {
  const cutoff = startOfLondonDay(now).toISOString();
  let q = client.from('swim_tests').select(TEST_COLUMNS);
  q = when === 'upcoming' ? q.gte('start_at', cutoff) : q.lt('start_at', cutoff);
  const { data: tests, error } = await q
    .order('start_at', { ascending: when === 'upcoming' })
    .order('title', { ascending: true })
    .limit(when === 'past' ? PAST_LIMIT : 1000);
  if (error) throw new Error(`swim_tests: ${error.message}`);
  if (!tests?.length) return { tests: [], slots: [] };
  const slots = await loadSlots(client, tests.map((t) => t.id));
  return { tests: tests as BetaTest[], slots };
}

export async function loadSlots(client: SupabaseClient, testIds: string[]): Promise<TestSlotRow[]> {
  if (testIds.length === 0) return [];
  const { data, error } = await client.from('swim_test_slots').select('*').in('test_id', testIds);
  if (error) throw new Error(`swim_test_slots: ${error.message}`);
  return (data ?? []) as TestSlotRow[];
}

/** One test (for a ?test= link to a test outside the current list). Null if it doesn't exist. */
export async function loadTest(client: SupabaseClient, id: string): Promise<{ test: BetaTest; slots: TestSlotRow[] } | null> {
  const { data, error } = await client.from('swim_tests').select(TEST_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(`swim_tests: ${error.message}`);
  if (!data) return null;
  return { test: data as BetaTest, slots: await loadSlots(client, [id]) };
}

export function matchesType(test: Pick<BetaTest, 'type'>, type: TestsType): boolean {
  if (type === 'swim') return test.type === 'Swim Test';
  if (type === 'capsize') return test.type === 'Capsize Drill';
  return true;
}

export function parseWhen(v: unknown): TestsWhen {
  return v === 'past' ? 'past' : 'upcoming';
}

export function parseType(v: unknown): TestsType {
  return v === 'swim' || v === 'capsize' ? v : 'all';
}

/** "Swim test" / "Capsize drill" for the list's type column. */
export function typeLabel(type: string | null): string {
  if (type === 'Swim Test') return 'Swim test';
  if (type === 'Capsize Drill') return 'Capsize drill';
  return type ?? 'Test';
}
