// src/server/live/client.ts
// Server-only: the service-role Supabase client and typed calls to the PER-276 write RPCs.
// SUPABASE_SERVICE_ROLE_KEY bypasses RLS, so this module must never be imported by browser code.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LiveResult } from '@/lib/live/types';

export type LiveRpc =
  | 'claim_seat'
  | 'set_seat_status'
  | 'swap_seats'
  | 'claim_test_slot'
  | 'set_test_outcome'
  | 'claim_marshal_slot'
  | 'save_unavailability'
  | 'save_outing_report'
  | 'undo_change';

export class LiveConfigError extends Error {
  constructor() {
    super('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
    this.name = 'LiveConfigError';
  }
}

let serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new LiveConfigError();
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return serviceClient;
}

/** What the RPCs return (see supabase/migrations/20261018100100_live_write_rpcs.sql). */
type RpcResult = {
  ok: boolean;
  reason?: string;
  message?: string;
  change_id?: number;
  row?: unknown;
  rows?: unknown[];
  outing_status?: { from: string | null; to: 'Confirmed' | 'Provisional' } | null;
  current?: unknown;
  holder_name?: string | null;
  updated_by_name?: string | null;
  held_seat?: string;
  held_slot?: number;
};

const FAILURE_REASONS = ['invalid', 'not_found', 'forbidden'] as const;

export function toLiveResult<Row>(raw: RpcResult): LiveResult<Row> {
  if (raw.ok) {
    return {
      ok: true,
      changeId: Number(raw.change_id),
      row: raw.row as Row,
      ...(raw.rows ? { rows: raw.rows as Row[] } : {}),
      outingStatus: raw.outing_status ?? null,
    };
  }
  if (raw.reason === 'conflict') {
    return {
      ok: false,
      reason: 'conflict',
      current: (raw.current ?? null) as Row | null,
      holderName: raw.holder_name ?? null,
      updatedByName: raw.updated_by_name ?? null,
      ...(raw.held_seat ? { heldSeat: raw.held_seat } : {}),
      ...(raw.held_slot ? { heldSlot: raw.held_slot } : {}),
      ...(raw.message ? { message: raw.message } : {}),
    };
  }
  const reason = FAILURE_REASONS.find((r) => r === raw.reason);
  if (!reason) throw new Error(`Unexpected RPC result reason: ${String(raw.reason)}`);
  // Messages come from fixed strings in the RPCs, never from Postgres errors
  return { ok: false, reason, ...(raw.message ? { message: raw.message } : {}) };
}

/** Call a write RPC. Throws on a transport or Postgres error (the route answers 500 without details). */
export async function callLiveRpc<Row>(fn: LiveRpc, args: Record<string, unknown>): Promise<LiveResult<Row>> {
  const { data, error } = await getServiceClient().rpc(fn, args);
  if (error) {
    throw Object.assign(new Error(`RPC ${fn} failed: ${error.message}`), { code: 'RPC_ERROR' });
  }
  if (!data || typeof data !== 'object') throw new Error(`RPC ${fn} returned no result`);
  return toLiveResult<Row>(data as RpcResult);
}
