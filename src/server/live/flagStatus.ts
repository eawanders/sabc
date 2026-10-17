// src/server/live/flagStatus.ts
// The river flag (OURCS, Isis) feeds the outing auto-confirm rules, which run in SQL and can't call
// out, so the seat routes fetch it here and pass it to the RPC. Cached for 60 s per server instance.
// Unknown (fetch failed) is null: the RPC then applies no bank-rider requirement, as the drawer did.
import logger from '@/app/api/_utils/logger';

const FLAG_URL = 'https://ourcs.co.uk/api/flags/status/isis/';
const TTL_MS = 60_000;
const TIMEOUT_MS = 2_000;

let cached: { value: string | null; at: number } | null = null;

export async function getFlagStatusText(now: number = Date.now()): Promise<string | null> {
  if (cached && now - cached.at < TTL_MS) return cached.value;
  let value: string | null = null;
  try {
    const res = await fetch(FLAG_URL, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) {
      const data: unknown = await res.json();
      const text = (data as { status_text?: unknown } | null)?.status_text;
      value = typeof text === 'string' && text.length > 0 && text.length < 40 ? text : null;
    }
  } catch (error) {
    logger.warn({ type: 'FLAG_STATUS_UNAVAILABLE', error: error instanceof Error ? error.message : 'unknown' });
  }
  // Cache failures too (briefly the same TTL) so a flag outage doesn't add 2 s to every write
  cached = { value, at: now };
  return value;
}

export function resetFlagStatusCache(): void {
  cached = null;
}
