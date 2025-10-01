import pino from 'pino';

// Redact sensitive fields from logs
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-cron-signature"]',
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      '*.password',
      '*.token',
      '*.secret',
    ],
    remove: true,
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      // Redact query params that might contain sensitive data
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
      },
    }),
  },
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});

export default logger;

// Helper to log API errors without exposing sensitive data
export function logApiError(
  error: unknown,
  context: {
    route: string;
    method: string;
    userId?: string;
    ip?: string;
  }
) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error({
    type: 'API_ERROR',
    route: context.route,
    method: context.method,
    userId: context.userId,
    ip: context.ip,
    error: errorMessage,
    // Only log stack in development
    ...(process.env.NODE_ENV === 'development' && { stack: errorStack }),
  });
}

// Helper to log security events
export function logSecurityEvent(
  event: 'AUTH_FAILURE' | 'RATE_LIMIT' | 'INVALID_SIGNATURE' | 'FORBIDDEN',
  details: {
    route: string;
    ip?: string;
    userId?: string;
    reason?: string;
  }
) {
  logger.warn({
    type: 'SECURITY_EVENT',
    event,
    ...details,
  });
}
