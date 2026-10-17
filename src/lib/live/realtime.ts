// src/lib/live/realtime.ts
// Realtime subscriptions with the anon key (PER-276). The anon key can read published rows and
// listen for changes; it cannot write. Writes go through /api/live/* (see write.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type LiveTable =
  | 'outings'
  | 'outing_seats'
  | 'outing_reports'
  | 'member_unavailability'
  | 'swim_test_slots'
  | 'marshal_slots';

export type LiveChange<Row> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Row | null;
  old: Row | null; // full old row: the tables use REPLICA IDENTITY FULL
};

let browserClient: SupabaseClient | null = null;

/** The anon-key client, or null when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY aren't set. */
export function getBrowserClient(): SupabaseClient | null {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  browserClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return browserClient;
}

let channelSeq = 0;

/**
 * Listen for changes to one table, optionally filtered (PostgREST syntax, e.g. `outing_id=eq.<id>`).
 * Returns an unsubscribe function. A no-op when Realtime isn't configured.
 */
export function subscribeToTable<Row extends Record<string, unknown>>(
  table: LiveTable,
  onChange: (change: LiveChange<Row>) => void,
  options: { filter?: string; client?: SupabaseClient | null } = {},
): () => void {
  const client = options.client === undefined ? getBrowserClient() : options.client;
  if (!client) return () => {};

  const channel = client
    .channel(`live:${table}:${options.filter ?? '*'}:${++channelSeq}`)
    .on<Row>(
      'postgres_changes',
      { event: '*', schema: 'public', table, ...(options.filter ? { filter: options.filter } : {}) },
      (payload) => {
        const hasKeys = (row: unknown): row is Row => !!row && typeof row === 'object' && Object.keys(row).length > 0;
        onChange({
          eventType: payload.eventType,
          new: hasKeys(payload.new) ? payload.new : null,
          old: hasKeys(payload.old) ? payload.old : null,
        });
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

/** All seat changes for one outing. */
export function subscribeToOutingSeats<Row extends Record<string, unknown>>(
  outingId: string,
  onChange: (change: LiveChange<Row>) => void,
  client?: SupabaseClient | null,
): () => void {
  return subscribeToTable<Row>('outing_seats', onChange, { filter: `outing_id=eq.${outingId}`, client });
}
