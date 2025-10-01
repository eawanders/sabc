import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { RateLimitError } from './rate-limit';
import logger, { logApiError } from './logger';

export interface ErrorContext {
  route: string;
  method: string;
  userId?: string;
  ip?: string;
}

/**
 * Standard error handler for API routes
 */
export function handleApiError(error: unknown, context: ErrorContext): NextResponse {
  // Log the error (with PII redaction)
  logApiError(error, context);

  // Handle known error types
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': error.meta.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(error.meta.reset).toISOString(),
          'Retry-After': Math.ceil((error.meta.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // Handle custom error codes
  if (error instanceof Error) {
    const code = (error as any).code;

    switch (code) {
      case 'UNAUTHENTICATED':
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

      case 'FORBIDDEN':
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });

      case 'NOT_FOUND':
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });

      case 'CONFLICT':
        return NextResponse.json({ error: 'Resource conflict' }, { status: 409 });
    }
  }

  // Generic server error (don't expose details to client)
  return NextResponse.json(
    {
      error: 'Internal server error',
      // Only include message in development
      ...(process.env.NODE_ENV === 'development' && {
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    },
    { status: 500 }
  );
}

/**
 * Helper to get client IP from request
 */
export function getClientIp(request: Request): string {
  // Check various headers set by proxies/CDNs
  const headers = request.headers;

  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') || // Cloudflare
    'unknown'
  );
}

/**
 * Create successful response with security headers
 */
export function createSuccessResponse<T>(
  data: T,
  options?: {
    status?: number;
    cacheable?: boolean;
  }
): NextResponse {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
  };

  // Disable caching for sensitive data by default
  if (!options?.cacheable) {
    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private';
    headers['Pragma'] = 'no-cache';
  }

  return NextResponse.json(data, {
    status: options?.status || 200,
    headers,
  });
}

/**
 * Validate request origin for CORS
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');

  if (!origin) {
    // Same-origin requests don't send Origin header
    return true;
  }

  const allowedOrigins = [
    'https://sabc-woad.vercel.app',
    'https://app.sabcoxford.com',
    // Allow preview deployments
    ...(process.env.VERCEL_ENV === 'preview' ? ['https://*.vercel.app'] : []),
  ];

  // Check exact matches
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check wildcard patterns
  for (const allowed of allowedOrigins) {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      if (new RegExp(`^${pattern}$`).test(origin)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(response: NextResponse, request: Request): NextResponse {
  const origin = request.headers.get('origin');

  if (origin && validateOrigin(request)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
}
