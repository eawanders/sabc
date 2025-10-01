/**
 * Auth utilities for SABC API routes
 *
 * NOTE: User authentication is currently disabled.
 * This file is kept for future implementation when auth is needed.
 *
 * Currently, API routes can optionally use:
 * - Rate limiting (via rate-limit.ts)
 * - Input validation (via schemas.ts)
 * - HMAC authentication for cron jobs (via hmac.ts)
 */

// Placeholder types for future auth implementation
export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: 'admin' | 'coach' | 'member';
}

export interface AuthSession {
  user: SessionUser;
  expires: string;
}

/**
 * Placeholder for future authentication
 * Currently returns null (no authentication enforced)
 */
export async function getOptionalSession(): Promise<AuthSession | null> {
  // TODO: Implement when auth is added
  return null;
}
