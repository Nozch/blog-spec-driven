import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Capture stdout writes for testing JSON log output.
 * We spy on process.stdout.write since console.log adds newlines
 * and the logger should control its own formatting.
 */
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let capturedOutput: string[];

const setupStdoutCapture = () => {
  capturedOutput = [];
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    if (typeof chunk === 'string') {
      capturedOutput.push(chunk);
    }
    return true;
  });
};

const teardownStdoutCapture = () => {
  stdoutSpy?.mockRestore();
};

const getLastLogEntry = (): Record<string, unknown> => {
  const lastOutput = capturedOutput[capturedOutput.length - 1];
  if (!lastOutput) {
    throw new Error('No log output captured');
  }
  // Remove trailing newline if present
  const jsonString = lastOutput.trim();
  return JSON.parse(jsonString);
};

const getAllLogEntries = (): Record<string, unknown>[] => {
  return capturedOutput.map((output) => JSON.parse(output.trim()));
};

// =============================================================================
// IMPORTS
// =============================================================================

import {
  createRequestLogger,
  type LogLevel,
  type FailureReason,
  type LogEntry,
  VALID_FAILURE_REASONS,
} from '../logger';

// =============================================================================
// TESTS
// =============================================================================

describe('Logger Infrastructure (T024)', () => {
  beforeEach(() => {
    setupStdoutCapture();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:30:00.000Z'));
  });

  afterEach(() => {
    teardownStdoutCapture();
    vi.useRealTimers();
  });

  // ===========================================================================
  // 1. Schema Validation Tests
  // ===========================================================================

  describe('Schema Validation', () => {
    it('LOG-001: all logs contain required fields (timestamp, level, event, request_id)', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('article.created');

      const entry = getLastLogEntry();
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('level');
      expect(entry).toHaveProperty('event');
      expect(entry).toHaveProperty('request_id');
    });

    it('LOG-002: timestamp is in ISO 8601 format', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('article.created');

      const entry = getLastLogEntry();
      expect(entry.timestamp).toBe('2025-01-15T10:30:00.000Z');
      // Validate ISO 8601 format with regex
      expect(entry.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('LOG-003: level is one of info, warn, error', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: null,
      });

      logger.info('article.created');
      logger.warn('tag_suggestion.requested', {
        failure_reason: 'TAG_SUGGESTION_TIMEOUT',
      });
      logger.error('article.fetched', {
        failure_reason: 'ARTICLE_NOT_FOUND',
      });

      const entries = getAllLogEntries();
      expect(entries[0].level).toBe('info');
      expect(entries[1].level).toBe('warn');
      expect(entries[2].level).toBe('error');
    });

    it('LOG-004: event follows resource.action naming pattern', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('article.created');
      logger.info('tag_suggestion.requested');

      const entries = getAllLogEntries();
      // Should match pattern: lowercase_resource.action
      entries.forEach((entry) => {
        expect(entry.event).toMatch(/^[a-z_]+\.[a-z_]+$/);
      });
    });

    it('LOG-005: request_id is included from context', () => {
      const logger = createRequestLogger({
        request_id: 'req-abc-123',
        article_id: 'art-456',
      });

      logger.info('article.created');

      const entry = getLastLogEntry();
      expect(entry.request_id).toBe('req-abc-123');
    });
  });

  // ===========================================================================
  // 2. Context Propagation Tests
  // ===========================================================================

  describe('Context Propagation', () => {
    it('LOG-010: createRequestLogger binds request_id and article_id to all calls', () => {
      const logger = createRequestLogger({
        request_id: 'req-999',
        article_id: 'art-888',
      });

      logger.info('article.created');
      logger.info('tag_suggestion.requested');

      const entries = getAllLogEntries();
      expect(entries[0].request_id).toBe('req-999');
      expect(entries[0].article_id).toBe('art-888');
      expect(entries[1].request_id).toBe('req-999');
      expect(entries[1].article_id).toBe('art-888');
    });

    it('LOG-011: additional fields merge with bound context', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('tag_suggestion.requested', { latency_ms: 150 });

      const entry = getLastLogEntry();
      expect(entry.request_id).toBe('req-123');
      expect(entry.article_id).toBe('art-456');
      expect(entry.latency_ms).toBe(150);
    });

    it('LOG-012: null article_id is allowed and serialized correctly', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: null,
      });

      logger.error('article.fetched', {
        failure_reason: 'ARTICLE_NOT_FOUND',
      });

      const entry = getLastLogEntry();
      expect(entry.article_id).toBeNull();
      expect(entry.request_id).toBe('req-123');
    });

    it('LOG-013: different logger instances maintain separate contexts', () => {
      const logger1 = createRequestLogger({
        request_id: 'req-111',
        article_id: 'art-111',
      });
      const logger2 = createRequestLogger({
        request_id: 'req-222',
        article_id: 'art-222',
      });

      logger1.info('article.created');
      logger2.info('article.updated');

      const entries = getAllLogEntries();
      expect(entries[0].request_id).toBe('req-111');
      expect(entries[0].article_id).toBe('art-111');
      expect(entries[1].request_id).toBe('req-222');
      expect(entries[1].article_id).toBe('art-222');
    });
  });

  // ===========================================================================
  // 3. Level Semantics Tests
  // ===========================================================================

  describe('Level Semantics', () => {
    it('LOG-020: info events do not have failure_reason field', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('article.created');

      const entry = getLastLogEntry();
      expect(entry.level).toBe('info');
      expect(entry).not.toHaveProperty('failure_reason');
    });

    it('LOG-021: warn events require failure_reason', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      // This should throw or log a warning because failure_reason is missing
      expect(() => {
        logger.warn('tag_suggestion.requested', {} as { failure_reason: FailureReason });
      }).toThrow(/failure_reason.*required/i);
    });

    it('LOG-022: error events require failure_reason', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      expect(() => {
        logger.error('article.fetched', {} as { failure_reason: FailureReason });
      }).toThrow(/failure_reason.*required/i);
    });

    it('LOG-023: warn event with valid failure_reason succeeds', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.warn('tag_suggestion.requested', {
        failure_reason: 'TAG_SUGGESTION_TIMEOUT',
        latency_ms: 5000,
      });

      const entry = getLastLogEntry();
      expect(entry.level).toBe('warn');
      expect(entry.failure_reason).toBe('TAG_SUGGESTION_TIMEOUT');
      expect(entry.latency_ms).toBe(5000);
    });

    it('LOG-024: error event with valid failure_reason succeeds', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: null,
      });

      logger.error('article.fetched', {
        failure_reason: 'ARTICLE_NOT_FOUND',
        failure_detail: 'Article with given ID does not exist',
      });

      const entry = getLastLogEntry();
      expect(entry.level).toBe('error');
      expect(entry.failure_reason).toBe('ARTICLE_NOT_FOUND');
      expect(entry.failure_detail).toBe('Article with given ID does not exist');
    });
  });

  // ===========================================================================
  // 4. Failure Reason Validation Tests
  // ===========================================================================

  describe('Failure Reason Validation', () => {
    it('LOG-030: accepts known failure reason values', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: null,
      });

      // Test a few known values
      logger.error('article.fetched', { failure_reason: 'ARTICLE_NOT_FOUND' });
      logger.warn('tag_suggestion.requested', { failure_reason: 'TAG_SUGGESTION_TIMEOUT' });
      logger.error('validation.failed', { failure_reason: 'VALIDATION_FAILED' });

      const entries = getAllLogEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].failure_reason).toBe('ARTICLE_NOT_FOUND');
      expect(entries[1].failure_reason).toBe('TAG_SUGGESTION_TIMEOUT');
      expect(entries[2].failure_reason).toBe('VALIDATION_FAILED');
    });

    it('LOG-031: rejects unknown failure reason values at runtime', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      // TypeScript won't catch this, but runtime should
      expect(() => {
        logger.error('some.event', {
          failure_reason: 'INVALID_REASON_NOT_IN_ENUM' as FailureReason,
        });
      }).toThrow(/invalid failure_reason/i);
    });

    it('LOG-032: VALID_FAILURE_REASONS export contains expected values', () => {
      expect(VALID_FAILURE_REASONS).toContain('ARTICLE_NOT_FOUND');
      expect(VALID_FAILURE_REASONS).toContain('TAG_SUGGESTION_TIMEOUT');
      expect(VALID_FAILURE_REASONS).toContain('TAG_SUGGESTION_LAMBDA_ERROR');
      expect(VALID_FAILURE_REASONS).toContain('VALIDATION_FAILED');
      expect(VALID_FAILURE_REASONS).toContain('REQUEST_PARSING_FAILED');
      expect(VALID_FAILURE_REASONS).toContain('INTERNAL_ERROR');
      expect(VALID_FAILURE_REASONS).toContain('SERVICE_UNAVAILABLE');
    });

    it('LOG-033: failure_detail respects max 200 character limit', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      const longDetail = 'x'.repeat(250);

      logger.error('validation.failed', {
        failure_reason: 'VALIDATION_FAILED',
        failure_detail: longDetail,
      });

      const entry = getLastLogEntry();
      // Should be truncated to 200 chars
      expect(entry.failure_detail).toHaveLength(200);
      expect(entry.failure_detail).toBe('x'.repeat(200));
    });

    it('LOG-034: failure_detail within limit is not truncated', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      const normalDetail = 'Title exceeds maximum length of 200 characters';

      logger.error('validation.failed', {
        failure_reason: 'VALIDATION_FAILED',
        failure_detail: normalDetail,
      });

      const entry = getLastLogEntry();
      expect(entry.failure_detail).toBe(normalDetail);
    });
  });

  // ===========================================================================
  // 5. Output Format Tests
  // ===========================================================================

  describe('Output Format', () => {
    it('LOG-040: outputs valid JSON to stdout', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('article.created');

      // getLastLogEntry would throw if not valid JSON
      const entry = getLastLogEntry();
      expect(entry).toBeDefined();
      expect(typeof entry).toBe('object');
    });

    it('LOG-041: each log line ends with newline', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('article.created');

      const lastOutput = capturedOutput[capturedOutput.length - 1];
      expect(lastOutput.endsWith('\n')).toBe(true);
    });

    it('LOG-042: handles special characters in failure_detail', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      const detailWithSpecialChars = 'Error: "Invalid JSON" at line\n5';

      logger.error('validation.failed', {
        failure_reason: 'VALIDATION_FAILED',
        failure_detail: detailWithSpecialChars,
      });

      const entry = getLastLogEntry();
      expect(entry.failure_detail).toBe(detailWithSpecialChars);
    });

    it('LOG-043: field ordering is consistent', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('article.created');

      const lastOutput = capturedOutput[capturedOutput.length - 1];
      const keys = Object.keys(JSON.parse(lastOutput.trim()));

      // Verify expected field order: timestamp, level, event, request_id, article_id
      expect(keys[0]).toBe('timestamp');
      expect(keys[1]).toBe('level');
      expect(keys[2]).toBe('event');
      expect(keys[3]).toBe('request_id');
    });

    it('LOG-044: omits undefined optional fields', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('article.created');

      const entry = getLastLogEntry();
      // Should not have latency_ms or failure_detail if not provided
      expect(entry).not.toHaveProperty('latency_ms');
      expect(entry).not.toHaveProperty('failure_detail');
    });

    it('LOG-045: includes latency_ms when provided', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('tag_suggestion.requested', { latency_ms: 250 });

      const entry = getLastLogEntry();
      expect(entry.latency_ms).toBe(250);
    });
  });

  // ===========================================================================
  // 6. Integration Pattern Tests (T023 compatibility)
  // ===========================================================================

  describe('Integration with T023 (Error Handler)', () => {
    it('LOG-050: logger can be used from error handler context', () => {
      // Simulate how T023 would create and use the logger
      const mockRequest = {
        method: 'POST',
        path: '/api/articles',
      };

      const logger = createRequestLogger({
        request_id: 'req-from-handler',
        article_id: 'art-123',
      });

      // T023 would call this when catching a domain error
      logger.error('article.fetched', {
        failure_reason: 'NOT_FOUND' as FailureReason,
      });

      const entry = getLastLogEntry();
      expect(entry.request_id).toBe('req-from-handler');
      expect(entry.level).toBe('error');
      expect(entry.failure_reason).toBe('NOT_FOUND');
    });

    it('LOG-051: logger preserves article_id=null for early failures', () => {
      // When error occurs before article_id is available (e.g., body parsing)
      const logger = createRequestLogger({
        request_id: 'req-early-fail',
        article_id: null,
      });

      logger.error('request.failed', {
        failure_reason: 'REQUEST_PARSING_FAILED',
        failure_detail: 'Invalid JSON in request body',
      });

      const entry = getLastLogEntry();
      expect(entry.article_id).toBeNull();
      expect(entry.failure_reason).toBe('REQUEST_PARSING_FAILED');
    });

    it('LOG-052: multiple events in same request share request_id', () => {
      const logger = createRequestLogger({
        request_id: 'req-multi-event',
        article_id: 'art-456',
      });

      // Simulate a request flow
      logger.info('article.fetched');
      logger.info('tag_suggestion.requested', { latency_ms: 100 });
      logger.info('tag_suggestion.requested', { latency_ms: 50 });

      const entries = getAllLogEntries();
      expect(entries).toHaveLength(3);
      entries.forEach((entry) => {
        expect(entry.request_id).toBe('req-multi-event');
      });
    });

    it('LOG-053: error handler can map domain error codes to failure_reason', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      // Map T023's error codes to T024's failure_reason
      const domainErrorCode = 'SERVICE_UNAVAILABLE';
      const mappedReason: FailureReason = 'SERVICE_UNAVAILABLE';

      logger.error('service.failed', {
        failure_reason: mappedReason,
        failure_detail: 'Database connection timeout',
      });

      const entry = getLastLogEntry();
      expect(entry.failure_reason).toBe(domainErrorCode);
    });
  });

  // ===========================================================================
  // 7. Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('LOG-060: handles empty event name gracefully', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      expect(() => {
        logger.info('');
      }).toThrow(/event.*required|invalid event/i);
    });

    it('LOG-061: handles very long event names', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      const longEvent = 'a'.repeat(100) + '.action';

      // Should either accept or reject consistently
      // We'll accept it for now as the pattern is valid
      logger.info(longEvent);

      const entry = getLastLogEntry();
      expect(entry.event).toBe(longEvent);
    });

    it('LOG-062: handles zero latency_ms', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      logger.info('tag_suggestion.requested', { latency_ms: 0 });

      const entry = getLastLogEntry();
      expect(entry.latency_ms).toBe(0);
    });

    it('LOG-063: handles negative latency_ms by rejecting', () => {
      const logger = createRequestLogger({
        request_id: 'req-123',
        article_id: 'art-456',
      });

      expect(() => {
        logger.info('tag_suggestion.requested', { latency_ms: -100 });
      }).toThrow(/latency_ms.*negative|invalid latency/i);
    });
  });
});
