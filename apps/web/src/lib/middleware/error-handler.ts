/**
 * Error Handler Middleware (T023)
 *
 * Provides a wrapper function for Next.js App Router API route handlers
 * that normalizes errors into consistent JSON responses.
 *
 * Key responsibilities:
 * - Execute wrapped handler and pass through successful responses unchanged
 * - Convert DomainError objects to structured JSON error responses
 * - Convert unknown errors to safe 500 responses (no internal details leaked)
 * - Log all errors with request context
 */

import { logError } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNPROCESSABLE_CONTENT'
  | 'NOT_FOUND'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR';

export type DomainError = {
  code: ErrorCode;
  status: number;
  message: string;
  details?: unknown;
};

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type RouteHandler = (request: Request) => Promise<Response>;

type ErrorContext = {
  method: string;
  path: string;
  status: number;
  code: string;
};

// =============================================================================
// Type Guard
// =============================================================================

/**
 * Type guard to check if an unknown value is a DomainError.
 */
export function isDomainError(error: unknown): error is DomainError {
  if (error === null || error === undefined) {
    return false;
  }

  if (typeof error !== 'object') {
    return false;
  }

  const obj = error as Record<string, unknown>;

  return (
    typeof obj.code === 'string' &&
    typeof obj.status === 'number' &&
    typeof obj.message === 'string'
  );
}

// =============================================================================
// Error Response Builder
// =============================================================================

function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  const body: ErrorResponse = {
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// =============================================================================
// Path Extractor
// =============================================================================

function extractPath(request: Request): string {
  try {
    const url = new URL(request.url);
    return url.pathname;
  } catch {
    return '/unknown';
  }
}

// =============================================================================
// Main Wrapper
// =============================================================================

/**
 * Wraps a route handler with error handling.
 *
 * - Passes through successful responses unchanged
 * - Converts DomainError to structured JSON response
 * - Converts unknown errors to safe 500 response
 * - Logs all errors with context
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (request: Request): Promise<Response> => {
    try {
      const response = await handler(request);
      return response;
    } catch (error: unknown) {
      const method = request.method;
      const path = extractPath(request);

      if (isDomainError(error)) {
        // Known domain error - use its status, code, message, details
        const context: ErrorContext = {
          method,
          path,
          status: error.status,
          code: error.code,
        };

        logError(error, context);

        return buildErrorResponse(
          error.status,
          error.code,
          error.message,
          error.details
        );
      }

      // Unknown error - return safe 500 response
      const context: ErrorContext = {
        method,
        path,
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
      };

      logError(error, context);

      return buildErrorResponse(
        500,
        'INTERNAL_SERVER_ERROR',
        'An unexpected error occurred'
      );
    }
  };
}
