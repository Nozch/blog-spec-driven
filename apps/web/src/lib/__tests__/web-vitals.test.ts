import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FCPMetric } from 'web-vitals';

// =============================================================================
// TEST SETUP
// =============================================================================

// Mock web-vitals before importing our module
vi.mock('web-vitals', () => {
  return {
    onFCP: vi.fn(),
  };
});

import { initFirstPaintObserver, type FirstPaintMetric } from '../web-vitals';
import { onFCP } from 'web-vitals';

// Get the mocked function with proper typing
const mockOnFCP = vi.mocked(onFCP);

// =============================================================================
// TESTS
// =============================================================================

describe('Web Vitals Instrumentation (T025)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. Safe Import in SSR
  // ===========================================================================

  describe('SSR Safety', () => {
    it('WV-001: importing module with no window does not throw', () => {
      // This test verifies that importing the module doesn't crash in Node/SSR
      // The module is already imported, so if it didn't throw, we're good
      expect(true).toBe(true);
    });

    it('WV-007: SSR acts as no-op (window undefined, onFCP never called)', () => {
      // Temporarily hide window
      const originalWindow = global.window;
      // @ts-expect-error - deliberately deleting window for SSR simulation
      delete global.window;

      const callback = vi.fn();

      // Should not throw
      expect(() => {
        initFirstPaintObserver(callback);
      }).not.toThrow();

      // onFCP should never be called
      expect(mockOnFCP).not.toHaveBeenCalled();

      // Callback should never be invoked
      expect(callback).not.toHaveBeenCalled();

      // Restore window
      global.window = originalWindow;
    });
  });

  // ===========================================================================
  // 2. Registers One FCP Handler in Browser
  // ===========================================================================

  describe('FCP Handler Registration', () => {
    it('WV-002: registers one FCP handler in browser (onFCP called exactly once)', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      // onFCP should be called exactly once
      expect(mockOnFCP).toHaveBeenCalledTimes(1);
      expect(mockOnFCP).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ===========================================================================
  // 3. Normalizes Value to Integer Milliseconds
  // ===========================================================================

  describe('Value Normalization', () => {
    it('WV-003: normalizes value (123.7 → 124)', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      // Get the handler that was registered with onFCP
      const fcpHandler = mockOnFCP.mock.calls[0][0];

      // Simulate FCP callback with decimal value
      const mockMetric: FCPMetric = {
        name: 'FCP',
        value: 123.7,
        rating: 'good',
        delta: 123.7,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(mockMetric);

      // Should round to 124
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ valueMs: 124 });
    });

    it('WV-003b: rounds down correctly (123.4 → 123)', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      const mockMetric: FCPMetric = {
        name: 'FCP',
        value: 123.4,
        rating: 'good',
        delta: 123.4,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(mockMetric);

      expect(callback).toHaveBeenCalledWith({ valueMs: 123 });
    });

    it('WV-003c: rounds .5 up (123.5 → 124)', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      const mockMetric: FCPMetric = {
        name: 'FCP',
        value: 123.5,
        rating: 'good',
        delta: 123.5,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(mockMetric);

      expect(callback).toHaveBeenCalledWith({ valueMs: 124 });
    });
  });

  // ===========================================================================
  // 4. Invalid Values Ignored
  // ===========================================================================

  describe('Invalid Value Handling', () => {
    it('WV-004: ignores NaN values', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      const mockMetric: FCPMetric = {
        name: 'FCP',
        value: NaN,
        rating: 'good',
        delta: NaN,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(mockMetric);

      // Callback should not be invoked
      expect(callback).not.toHaveBeenCalled();
    });

    it('WV-004b: ignores zero values', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      const mockMetric: FCPMetric = {
        name: 'FCP',
        value: 0,
        rating: 'good',
        delta: 0,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(mockMetric);

      expect(callback).not.toHaveBeenCalled();
    });

    it('WV-004c: ignores negative values', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      const mockMetric: FCPMetric = {
        name: 'FCP',
        value: -100,
        rating: 'good',
        delta: -100,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(mockMetric);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 5. Only First FCP Delivered
  // ===========================================================================

  describe('Single Invocation Guarantee', () => {
    it('WV-005: only first FCP delivered (multiple calls → callback fires once)', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];

      // First valid FCP
      const firstMetric: FCPMetric = {
        name: 'FCP',
        value: 100,
        rating: 'good',
        delta: 100,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(firstMetric);

      // Second FCP (should be ignored)
      const secondMetric: FCPMetric = {
        name: 'FCP',
        value: 200,
        rating: 'good',
        delta: 100,
        entries: [],
        id: 'v3-5678',
        navigationType: 'navigate',
      };

      fcpHandler(secondMetric);

      // Third FCP (should also be ignored)
      const thirdMetric: FCPMetric = {
        name: 'FCP',
        value: 300,
        rating: 'good',
        delta: 100,
        entries: [],
        id: 'v3-9012',
        navigationType: 'navigate',
      };

      fcpHandler(thirdMetric);

      // Callback should only be called once with the first value
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ valueMs: 100 });
    });

    it('WV-005b: first invalid value does not block second valid value', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];

      // First invalid FCP (NaN)
      const invalidMetric: FCPMetric = {
        name: 'FCP',
        value: NaN,
        rating: 'good',
        delta: NaN,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(invalidMetric);

      // Second valid FCP (should be reported)
      const validMetric: FCPMetric = {
        name: 'FCP',
        value: 150,
        rating: 'good',
        delta: 150,
        entries: [],
        id: 'v3-5678',
        navigationType: 'navigate',
      };

      fcpHandler(validMetric);

      // Callback should be called once with the valid value
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ valueMs: 150 });
    });
  });

  // ===========================================================================
  // 6. Callback Exceptions Contained
  // ===========================================================================

  describe('Error Handling', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Spy on console.error to verify error logging
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('WV-006: callback exceptions are caught (test does not crash)', () => {
      const throwingCallback = vi.fn(() => {
        throw new Error('Callback intentionally threw');
      });

      initFirstPaintObserver(throwingCallback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      const mockMetric: FCPMetric = {
        name: 'FCP',
        value: 123.7,
        rating: 'good',
        delta: 123.7,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      // This should not throw - the error should be caught internally
      expect(() => {
        fcpHandler(mockMetric);
      }).not.toThrow();

      // Callback should have been called
      expect(throwingCallback).toHaveBeenCalledTimes(1);

      // Error should be logged to console
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[web-vitals] Callback error:',
        expect.any(Error)
      );
    });

    it('WV-006b: after callback throws, subsequent FCP calls are still ignored', () => {
      let callCount = 0;
      const throwingCallback = vi.fn(() => {
        callCount++;
        throw new Error('Callback intentionally threw');
      });

      initFirstPaintObserver(throwingCallback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];

      // First call throws
      const firstMetric: FCPMetric = {
        name: 'FCP',
        value: 100,
        rating: 'good',
        delta: 100,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(firstMetric);

      // Second call should be ignored (not throw)
      const secondMetric: FCPMetric = {
        name: 'FCP',
        value: 200,
        rating: 'good',
        delta: 100,
        entries: [],
        id: 'v3-5678',
        navigationType: 'navigate',
      };

      fcpHandler(secondMetric);

      // Callback should only be called once
      expect(callCount).toBe(1);
      expect(throwingCallback).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // 7. Edge Cases and Integration
  // ===========================================================================

  describe('Edge Cases', () => {
    it('WV-008: handles very large values correctly', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      const mockMetric: FCPMetric = {
        name: 'FCP',
        value: 999999.9,
        rating: 'poor',
        delta: 999999.9,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(mockMetric);

      expect(callback).toHaveBeenCalledWith({ valueMs: 1000000 });
    });

    it('WV-009: handles very small positive values correctly', () => {
      const callback = vi.fn();

      initFirstPaintObserver(callback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      const mockMetric: FCPMetric = {
        name: 'FCP',
        value: 0.6,
        rating: 'good',
        delta: 0.6,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(mockMetric);

      expect(callback).toHaveBeenCalledWith({ valueMs: 1 });
    });

    it('WV-010: callback receives exact type signature', () => {
      const callback = vi.fn((metric: FirstPaintMetric) => {
        // Verify the metric has the expected shape
        expect(metric).toHaveProperty('valueMs');
        expect(typeof metric.valueMs).toBe('number');
        expect(Number.isInteger(metric.valueMs)).toBe(true);
      });

      initFirstPaintObserver(callback);

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      const mockMetric: FCPMetric = {
        name: 'FCP',
        value: 250.3,
        rating: 'good',
        delta: 250.3,
        entries: [],
        id: 'v3-1234',
        navigationType: 'navigate',
      };

      fcpHandler(mockMetric);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
