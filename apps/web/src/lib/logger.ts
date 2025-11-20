/**
 * Logger Infrastructure (T024)
 *
 * Provides structured JSON logging for server-side business events
 * with contextual fields for observability (OR-001, OR-002).
 *
 * Key responsibilities:
 * - Emit structured JSON logs to stdout
 * - Attach request context (request_id, article_id) to all events
 * - Enforce failure_reason enum for warn/error levels
 * - Support latency_ms for performance tracking
 */

// =============================================================================
// Types
// =============================================================================

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Valid failure reasons (enum-like for stable aggregation).
 * Add new values here as needed - this is the source of truth.
 */
export const VALID_FAILURE_REASONS = [
  'ARTICLE_NOT_FOUND',
  'TAG_SUGGESTION_TIMEOUT',
  'TAG_SUGGESTION_LAMBDA_ERROR',
  'VALIDATION_FAILED',
  'REQUEST_PARSING_FAILED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'NOT_FOUND',
  'UNPROCESSABLE_CONTENT',
] as const;

export type FailureReason = (typeof VALID_FAILURE_REASONS)[number];

/**
 * Base context provided when creating a request logger.
 */
export type RequestContext = {
  request_id: string;
  article_id: string | null;
};

/**
 * Additional fields that can be passed to log calls.
 */
export type LogFields = {
  failure_reason?: FailureReason;
  failure_detail?: string;
  latency_ms?: number;
};

/**
 * Fields required for warn/error levels.
 */
export type FailureFields = {
  failure_reason: FailureReason;
  failure_detail?: string;
  latency_ms?: number;
};

/**
 * Optional fields for info level.
 */
export type InfoFields = {
  latency_ms?: number;
};

/**
 * Complete log entry structure.
 */
export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  event: string;
  request_id: string;
  article_id: string | null;
  failure_reason?: FailureReason;
  failure_detail?: string;
  latency_ms?: number;
};

/**
 * Pre-bound logger interface returned by createRequestLogger.
 */
export type RequestLogger = {
  info: (event: string, fields?: InfoFields) => void;
  warn: (event: string, fields: FailureFields) => void;
  error: (event: string, fields: FailureFields) => void;
};

// =============================================================================
// Constants
// =============================================================================

const MAX_FAILURE_DETAIL_LENGTH = 200;

// =============================================================================
// Validation Helpers
// =============================================================================

function isValidFailureReason(reason: string): reason is FailureReason {
  return VALID_FAILURE_REASONS.includes(reason as FailureReason);
}

function validateEvent(event: string): void {
  if (!event || event.trim() === '') {
    throw new Error('event is required and cannot be empty');
  }
}

function validateFailureReason(reason: unknown): void {
  if (!reason || typeof reason !== 'string') {
    throw new Error('failure_reason is required for warn/error levels');
  }
  if (!isValidFailureReason(reason)) {
    throw new Error(
      `Invalid failure_reason: "${reason}". Must be one of: ${VALID_FAILURE_REASONS.join(', ')}`
    );
  }
}

function validateLatency(latency_ms: number | undefined): void {
  if (latency_ms !== undefined && latency_ms < 0) {
    throw new Error('latency_ms cannot be negative');
  }
}

function truncateFailureDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  if (detail.length > MAX_FAILURE_DETAIL_LENGTH) {
    return detail.substring(0, MAX_FAILURE_DETAIL_LENGTH);
  }
  return detail;
}

// =============================================================================
// Core Logging
// =============================================================================

function writeLog(entry: LogEntry): void {
  // Build object with consistent field ordering
  const orderedEntry: Record<string, unknown> = {
    timestamp: entry.timestamp,
    level: entry.level,
    event: entry.event,
    request_id: entry.request_id,
    article_id: entry.article_id,
  };

  // Add optional fields only if present
  if (entry.failure_reason !== undefined) {
    orderedEntry.failure_reason = entry.failure_reason;
  }
  if (entry.failure_detail !== undefined) {
    orderedEntry.failure_detail = entry.failure_detail;
  }
  if (entry.latency_ms !== undefined) {
    orderedEntry.latency_ms = entry.latency_ms;
  }

  const json = JSON.stringify(orderedEntry);
  process.stdout.write(json + '\n');
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Create a pre-bound logger for a specific request.
 *
 * @example
 * const logger = createRequestLogger({
 *   request_id: crypto.randomUUID(),
 *   article_id: params.articleId
 * });
 *
 * logger.info('article.created');
 * logger.warn('tag_suggestion.requested', {
 *   failure_reason: 'TAG_SUGGESTION_TIMEOUT',
 *   latency_ms: 5000
 * });
 */
export function createRequestLogger(context: RequestContext): RequestLogger {
  const { request_id, article_id } = context;

  const createEntry = (
    level: LogLevel,
    event: string,
    fields?: LogFields
  ): LogEntry => {
    return {
      timestamp: new Date().toISOString(),
      level,
      event,
      request_id,
      article_id,
      failure_reason: fields?.failure_reason,
      failure_detail: truncateFailureDetail(fields?.failure_detail),
      latency_ms: fields?.latency_ms,
    };
  };

  return {
    info(event: string, fields?: InfoFields): void {
      validateEvent(event);
      if (fields?.latency_ms !== undefined) {
        validateLatency(fields.latency_ms);
      }

      const entry = createEntry('info', event, fields);
      writeLog(entry);
    },

    warn(event: string, fields: FailureFields): void {
      validateEvent(event);
      validateFailureReason(fields.failure_reason);
      if (fields.latency_ms !== undefined) {
        validateLatency(fields.latency_ms);
      }

      const entry = createEntry('warn', event, fields);
      writeLog(entry);
    },

    error(event: string, fields: FailureFields): void {
      validateEvent(event);
      validateFailureReason(fields.failure_reason);
      if (fields.latency_ms !== undefined) {
        validateLatency(fields.latency_ms);
      }

      const entry = createEntry('error', event, fields);
      writeLog(entry);
    },
  };
}

// =============================================================================
// Legacy API (T023 compatibility)
// =============================================================================

/**
 * @deprecated Use createRequestLogger instead.
 * This is maintained for T023 error handler compatibility during migration.
 *
 * Note: This function will need to be updated when T023 is refactored
 * to use the new logger API.
 */
export type ErrorContext = {
  method: string;
  path: string;
  status: number;
  code: string;
};

/**
 * @deprecated Use createRequestLogger instead.
 *
 * Legacy function for T023 compatibility. Logs errors using the old interface.
 * T023 should be updated to use createRequestLogger in a future iteration.
 */
export function logError(error: unknown, context: ErrorContext): void {
  // For now, output in a format compatible with existing tests
  // This will be refactored when T023 adopts the new logger
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'error' as const,
    event: 'error.occurred',
    // Generate a placeholder request_id since legacy API doesn't have it
    request_id: 'legacy-' + Date.now(),
    article_id: null,
    failure_reason: context.code as FailureReason,
    failure_detail: error instanceof Error ? error.message : String(error),
    // Include legacy context for debugging
    _legacy_context: {
      method: context.method,
      path: context.path,
      status: context.status,
    },
  };

  const json = JSON.stringify(entry);
  process.stdout.write(json + '\n');
}
