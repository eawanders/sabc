// src/lib/live/write.ts
// Browser-side calls to the /api/live/* routes (PER-276). Every helper resolves to a LiveResult
// discriminated union and never throws: check `result.ok`, then `result.reason`.
import type {
  ClaimMarshalSlotInput,
  ClaimSeatInput,
  ClaimTestSlotInput,
  SaveOutingReportInput,
  SaveUnavailabilityInput,
  SetSeatStatusInput,
  SetTestOutcomeInput,
  SwapSeatsInput,
  UndoInput,
} from './schemas';
import type {
  LiveResult,
  MarshalSlotRow,
  OutingReportRow,
  SeatRow,
  TestSlotRow,
  UnavailabilityRow,
} from './types';

export type LivePath =
  | 'seat/claim'
  | 'seat/status'
  | 'seat/swap'
  | 'test-slot/claim'
  | 'test-slot/outcome'
  | 'marshal-slot/claim'
  | 'unavailability'
  | 'outing-report'
  | 'undo';

function isLiveResult(value: unknown): value is LiveResult<unknown> {
  return !!value && typeof value === 'object' && typeof (value as { ok?: unknown }).ok === 'boolean';
}

export async function liveWrite<Row>(
  path: LivePath,
  body: object,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveResult<Row>> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/live/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: 'error', message: 'Could not reach the server' };
  }
  const json: unknown = await res.json().catch(() => null);
  if (isLiveResult(json)) return json as LiveResult<Row>;
  return { ok: false, reason: res.status === 429 ? 'rate_limited' : 'error' };
}

export const claimSeat = (input: ClaimSeatInput) => liveWrite<SeatRow>('seat/claim', input);
export const setSeatStatus = (input: SetSeatStatusInput) => liveWrite<SeatRow>('seat/status', input);
export const swapSeats = (input: SwapSeatsInput) => liveWrite<SeatRow>('seat/swap', input);
export const claimTestSlot = (input: ClaimTestSlotInput) => liveWrite<TestSlotRow>('test-slot/claim', input);
export const setTestOutcome = (input: SetTestOutcomeInput) => liveWrite<TestSlotRow>('test-slot/outcome', input);
export const claimMarshalSlot = (input: ClaimMarshalSlotInput) => liveWrite<MarshalSlotRow>('marshal-slot/claim', input);
export const saveUnavailability = (input: SaveUnavailabilityInput) =>
  liveWrite<UnavailabilityRow>('unavailability', input);
export const saveOutingReport = (input: SaveOutingReportInput) => liveWrite<OutingReportRow>('outing-report', input);
export const undoChange = (input: UndoInput) => liveWrite<unknown>('undo', input);
