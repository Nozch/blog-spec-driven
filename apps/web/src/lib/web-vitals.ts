// =============================================================================
// WEB VITALS INSTRUMENTATION (T025)
// =============================================================================
//
// This module provides First Contentful Paint (FCP) measurement for frontend
// performance monitoring. It exposes a minimal API that captures the first
// paint metric and normalizes it to integer milliseconds.
//
// Usage Constraint:
// initFirstPaintObserver is expected to be called once per page load
// (e.g., from Next.js reportWebVitals). Calling it multiple times is
// undefined behavior; callers must ensure it is invoked only once.
//
// =============================================================================

import { onFCP, type FCPMetric } from 'web-vitals';

// =============================================================================
// TYPES
// =============================================================================

/**
 * First paint metric normalized to integer milliseconds.
 */
export type FirstPaintMetric = {
  valueMs: number;
};

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Initialize First Contentful Paint observer.
 *
 * @param onFirstPaint - Callback invoked once when FCP is measured
 *
 * Behavior:
 * - Uses web-vitals library (onFCP) to detect First Contentful Paint
 * - Converts FCP value to integer milliseconds using Math.round
 * - Calls onFirstPaint once, on the first valid FCP only
 * - Ignores invalid values (NaN or <= 0)
 * - Safe to import in SSR/Node (no-op when window is unavailable)
 * - Catches and suppresses exceptions thrown by the callback
 */
export function initFirstPaintObserver(
  onFirstPaint: (metric: FirstPaintMetric) => void
): void {
  // SSR safety: do nothing if window is not available
  if (typeof window === 'undefined') {
    return;
  }

  let hasReported = false;

  try {
    onFCP((metric: FCPMetric) => {
      // Only report the first valid FCP measurement
      if (hasReported) {
        return;
      }

      const { value } = metric;

      // Ignore invalid values
      if (Number.isNaN(value) || value <= 0) {
        return;
      }

      // Normalize to integer milliseconds
      const valueMs = Math.round(value);

      // Mark as reported before calling callback to handle re-entrancy
      hasReported = true;

      try {
        // Call the user-provided callback
        onFirstPaint({ valueMs });
      } catch (error) {
        // Catch and suppress callback exceptions to prevent app crashes
        // In production, this might be logged to an error tracking service
        // For now, we silently suppress to meet the "must not crash" requirement
        console.error('[web-vitals] Callback error:', error);
      }
    });
  } catch (error) {
    // Catch and suppress any errors from onFCP registration
    // This ensures that vitals collection failures don't break the app
    console.error('[web-vitals] Registration error:', error);
  }
}
