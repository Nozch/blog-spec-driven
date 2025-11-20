import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

import {
  withErrorHandling,
  isDomainError,
  type DomainError,
} from '../middleware/error-handler';
import { logError } from '@/lib/logger';

// Get the mocked function for assertions
const mockLogError = vi.mocked(logError);

// =============================================================================
// TEST UTILITIES
// =============================================================================

const createRequest = (method: string = 'GET', path: string = '/api/test') => {
  return new Request(`https://example.com${path}`, { method });
};

// =============================================================================
// TESTS
// =============================================================================

describe('withErrorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Success pass-through
  // ===========================================================================

  describe('success pass-through', () => {
    it('returns the same status and body when handler succeeds', async () => {
      const expectedBody = { data: 'success', id: 123 };
      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(expectedBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const wrappedHandler = withErrorHandling(handler);
      const request = createRequest('POST', '/api/articles');
      const response = await wrappedHandler(request);

      // Assert status is unchanged
      expect(response.status).toBe(200);

      // Assert body is exactly the same
      const responseBody = await response.json();
      expect(responseBody).toEqual(expectedBody);

      // Assert logError is NOT called
      expect(mockLogError).not.toHaveBeenCalled();
    });

    it('passes through non-200 success responses unchanged', async () => {
      const expectedBody = { created: true };
      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(expectedBody), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(createRequest());

      expect(response.status).toBe(201);
      const responseBody = await response.json();
      expect(responseBody).toEqual(expectedBody);
      expect(mockLogError).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Validation error (400)
  // ===========================================================================

  describe('validation error (400)', () => {
    it('returns 400 with correct error shape when VALIDATION_ERROR is thrown', async () => {
      const domainError: DomainError = {
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Invalid request',
        details: { field: 'title' },
      };

      const handler = vi.fn().mockRejectedValue(domainError);
      const wrappedHandler = withErrorHandling(handler);
      const request = createRequest('POST', '/api/articles');
      const response = await wrappedHandler(request);

      // Assert HTTP status
      expect(response.status).toBe(400);

      // Assert JSON body shape
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: { field: 'title' },
        },
      });

      // Assert logError called with correct context
      expect(mockLogError).toHaveBeenCalledTimes(1);
      expect(mockLogError).toHaveBeenCalledWith(
        domainError,
        expect.objectContaining({
          method: 'POST',
          path: '/api/articles',
          status: 400,
          code: 'VALIDATION_ERROR',
        })
      );
    });

    it('handles validation error without details', async () => {
      const domainError: DomainError = {
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Missing required fields',
      };

      const handler = vi.fn().mockRejectedValue(domainError);
      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(createRequest());

      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody.error.code).toBe('VALIDATION_ERROR');
      expect(responseBody.error.message).toBe('Missing required fields');
      expect(responseBody.error.details).toBeUndefined();
    });
  });

  // ===========================================================================
  // Unprocessable content (422)
  // ===========================================================================

  describe('unprocessable content (422)', () => {
    it('returns 422 for business rule violations', async () => {
      const domainError: DomainError = {
        code: 'UNPROCESSABLE_CONTENT',
        status: 422,
        message: 'File size exceeds 8 MB limit',
        details: { maxSize: 8388608, actualSize: 10485760 },
      };

      const handler = vi.fn().mockRejectedValue(domainError);
      const wrappedHandler = withErrorHandling(handler);
      const request = createRequest('POST', '/api/articles/import');
      const response = await wrappedHandler(request);

      expect(response.status).toBe(422);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        error: {
          code: 'UNPROCESSABLE_CONTENT',
          message: 'File size exceeds 8 MB limit',
          details: { maxSize: 8388608, actualSize: 10485760 },
        },
      });

      expect(mockLogError).toHaveBeenCalledTimes(1);
      expect(mockLogError).toHaveBeenCalledWith(
        domainError,
        expect.objectContaining({
          status: 422,
          code: 'UNPROCESSABLE_CONTENT',
        })
      );
    });

    it('returns 422 for past datetime scheduling', async () => {
      const domainError: DomainError = {
        code: 'UNPROCESSABLE_CONTENT',
        status: 422,
        message: 'Cannot schedule for a past time',
      };

      const handler = vi.fn().mockRejectedValue(domainError);
      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(createRequest());

      expect(response.status).toBe(422);

      const responseBody = await response.json();
      expect(responseBody.error.code).toBe('UNPROCESSABLE_CONTENT');
      expect(mockLogError).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Not found (404)
  // ===========================================================================

  describe('not found (404)', () => {
    it('returns 404 when resource is not found', async () => {
      const domainError: DomainError = {
        code: 'NOT_FOUND',
        status: 404,
        message: 'Article not found',
        details: { articleId: 'abc-123' },
      };

      const handler = vi.fn().mockRejectedValue(domainError);
      const wrappedHandler = withErrorHandling(handler);
      const request = createRequest('GET', '/api/articles/abc-123');
      const response = await wrappedHandler(request);

      expect(response.status).toBe(404);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Article not found',
          details: { articleId: 'abc-123' },
        },
      });

      expect(mockLogError).toHaveBeenCalledTimes(1);
      expect(mockLogError).toHaveBeenCalledWith(
        domainError,
        expect.objectContaining({
          method: 'GET',
          path: '/api/articles/abc-123',
          status: 404,
          code: 'NOT_FOUND',
        })
      );
    });
  });

  // ===========================================================================
  // Service unavailable (503)
  // ===========================================================================

  describe('service unavailable (503)', () => {
    it('returns 503 for S3 failures', async () => {
      const domainError: DomainError = {
        code: 'SERVICE_UNAVAILABLE',
        status: 503,
        message: 'Storage service temporarily unavailable',
        details: { service: 's3' },
      };

      const handler = vi.fn().mockRejectedValue(domainError);
      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(createRequest());

      expect(response.status).toBe(503);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Storage service temporarily unavailable',
          details: { service: 's3' },
        },
      });

      expect(mockLogError).toHaveBeenCalledTimes(1);
      expect(mockLogError).toHaveBeenCalledWith(
        domainError,
        expect.objectContaining({
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
        })
      );
    });

    it('returns 503 for Supabase failures', async () => {
      const domainError: DomainError = {
        code: 'SERVICE_UNAVAILABLE',
        status: 503,
        message: 'Database service temporarily unavailable',
        details: { service: 'supabase' },
      };

      const handler = vi.fn().mockRejectedValue(domainError);
      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(createRequest());

      expect(response.status).toBe(503);

      const responseBody = await response.json();
      expect(responseBody.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(mockLogError).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Unexpected error → 500
  // ===========================================================================

  describe('unexpected error → 500', () => {
    it('returns 500 with safe message for plain Error', async () => {
      const originalError = new Error('boom');
      const handler = vi.fn().mockRejectedValue(originalError);
      const wrappedHandler = withErrorHandling(handler);
      const request = createRequest('POST', '/api/articles');
      const response = await wrappedHandler(request);

      // Assert HTTP status is 500
      expect(response.status).toBe(500);

      const responseBody = await response.json();

      // Assert error code is INTERNAL_SERVER_ERROR
      expect(responseBody.error.code).toBe('INTERNAL_SERVER_ERROR');

      // Assert original error message is NOT leaked
      expect(responseBody.error.message).not.toContain('boom');
      expect(responseBody.error.message).toBeDefined();
      expect(typeof responseBody.error.message).toBe('string');

      // Assert logError is still called
      expect(mockLogError).toHaveBeenCalledTimes(1);
      expect(mockLogError).toHaveBeenCalledWith(
        originalError,
        expect.objectContaining({
          method: 'POST',
          path: '/api/articles',
          status: 500,
          code: 'INTERNAL_SERVER_ERROR',
        })
      );
    });

    it('returns 500 for thrown string', async () => {
      const handler = vi.fn().mockRejectedValue('unexpected string error');
      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(createRequest());

      expect(response.status).toBe(500);

      const responseBody = await response.json();
      expect(responseBody.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(responseBody.error.message).not.toContain('unexpected string error');
      expect(mockLogError).toHaveBeenCalledTimes(1);
    });

    it('returns 500 for thrown null', async () => {
      const handler = vi.fn().mockRejectedValue(null);
      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(createRequest());

      expect(response.status).toBe(500);

      const responseBody = await response.json();
      expect(responseBody.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(mockLogError).toHaveBeenCalledTimes(1);
    });

    it('does not leak stack traces in 500 response', async () => {
      const errorWithStack = new Error('sensitive database error');
      errorWithStack.stack = 'Error: sensitive database error\n    at ...\n    at ...';

      const handler = vi.fn().mockRejectedValue(errorWithStack);
      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(createRequest());

      expect(response.status).toBe(500);

      const responseBody = await response.json();
      const responseText = JSON.stringify(responseBody);

      // Ensure no sensitive info is leaked
      expect(responseText).not.toContain('sensitive database error');
      expect(responseText).not.toContain('at ...');
      expect(responseBody.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  // ===========================================================================
  // Type guard: isDomainError
  // ===========================================================================

  describe('isDomainError', () => {
    it('returns true for well-formed DomainError object', () => {
      const domainError: DomainError = {
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Invalid',
      };

      expect(isDomainError(domainError)).toBe(true);
    });

    it('returns true for DomainError with details', () => {
      const domainError: DomainError = {
        code: 'NOT_FOUND',
        status: 404,
        message: 'Not found',
        details: { id: '123' },
      };

      expect(isDomainError(domainError)).toBe(true);
    });

    it('returns false for plain Error', () => {
      expect(isDomainError(new Error('test'))).toBe(false);
    });

    it('returns false for null', () => {
      expect(isDomainError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isDomainError(undefined)).toBe(false);
    });

    it('returns false for number', () => {
      expect(isDomainError(42)).toBe(false);
    });

    it('returns false for string', () => {
      expect(isDomainError('error')).toBe(false);
    });

    it('returns false for object missing required fields', () => {
      expect(isDomainError({ code: 'VALIDATION_ERROR' })).toBe(false);
      expect(isDomainError({ status: 400 })).toBe(false);
      expect(isDomainError({ message: 'test' })).toBe(false);
      expect(isDomainError({ code: 'VALIDATION_ERROR', status: 400 })).toBe(false);
    });

    it('returns false for object with invalid code type', () => {
      expect(isDomainError({ code: 123, status: 400, message: 'test' })).toBe(false);
    });

    it('returns false for object with invalid status type', () => {
      expect(isDomainError({ code: 'VALIDATION_ERROR', status: '400', message: 'test' })).toBe(false);
    });
  });
});
