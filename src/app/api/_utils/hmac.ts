import crypto from 'node:crypto';

/**
 * Generate HMAC signature for a payload with timestamp
 * Format: HMAC-SHA256(secret, timestamp + "." + payload)
 */
export function sign(payload: string, timestamp: number): string {
  const secret = process.env.CRON_HMAC_KEY;
  if (!secret) {
    throw new Error('CRON_HMAC_KEY environment variable is not set');
  }

  const message = `${timestamp}.${payload}`;
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Verify HMAC signature with replay protection
 * @param signature - The signature to verify
 * @param payload - The original payload
 * @param timestamp - The timestamp from the request
 * @param toleranceMs - Maximum age of the request in milliseconds (default: 5 minutes)
 */
export function verify(
  signature: string,
  payload: string,
  timestamp: number,
  toleranceMs: number = 5 * 60 * 1000
): boolean {
  const secret = process.env.CRON_HMAC_KEY;
  if (!secret) {
    throw new Error('CRON_HMAC_KEY environment variable is not set');
  }

  // Check timestamp freshness (replay protection)
  const age = Math.abs(Date.now() - timestamp);
  if (age > toleranceMs) {
    return false;
  }

  // Compute expected signature
  const expected = sign(payload, timestamp);

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    // If buffers are different lengths, timingSafeEqual throws
    return false;
  }
}

/**
 * Extract and verify HMAC from request headers
 */
export function verifyRequest(
  headers: Headers,
  body: string,
  toleranceMs?: number
): { valid: boolean; reason?: string } {
  const timestamp = headers.get('x-cron-timestamp');
  const signature = headers.get('x-cron-signature');

  if (!timestamp) {
    return { valid: false, reason: 'Missing x-cron-timestamp header' };
  }

  if (!signature) {
    return { valid: false, reason: 'Missing x-cron-signature header' };
  }

  const ts = Number(timestamp);
  if (isNaN(ts) || ts <= 0) {
    return { valid: false, reason: 'Invalid timestamp format' };
  }

  try {
    const isValid = verify(signature, body, ts, toleranceMs);
    return {
      valid: isValid,
      reason: isValid ? undefined : 'Invalid signature or timestamp too old',
    };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : 'Verification error',
    };
  }
}
