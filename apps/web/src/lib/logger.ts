/**
 * Logger Infrastructure (T024 - Stub)
 *
 * This is a minimal stub for the error handler tests.
 * Full implementation will be done in T024.
 */

export type ErrorContext = {
  method: string;
  path: string;
  status: number;
  code: string;
};

/**
 * Log an error with context.
 * This stub will be replaced by the full T024 implementation.
 */
export function logError(error: unknown, context: ErrorContext): void {
  // Stub implementation - T024 will add proper structured logging
  console.error('[Error]', {
    error,
    ...context,
  });
}
