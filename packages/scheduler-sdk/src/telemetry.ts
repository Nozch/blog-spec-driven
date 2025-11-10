/**
 * Shared telemetry wrapper for metrics defined in OR-002.
 * Provides typed helpers for emitting metrics via a pluggable transport.
 */

export type TelemetryMetricName =
  | 'frontend.first_paint_ms'
  | 'import.duration_ms'
  | 'publish.success_rate'
  | 'publish.failure_count'
  | 'draft.encryption_check_pass';

export type TelemetryTags = Record<string, string>;

export interface TelemetryEvent {
  metric: TelemetryMetricName;
  value: number | boolean;
  tags: TelemetryTags;
  timestamp: string;
  unit?: 'ms' | 'ratio' | 'count';
}

export type TelemetryTransport = (
  event: TelemetryEvent,
) => Promise<void> | void;

const consoleTransport: TelemetryTransport = (event) => {
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[telemetry]', event);
  }
};

export interface TelemetryLoggerOptions {
  transport?: TelemetryTransport;
  defaultTags?: TelemetryTags;
  clock?: () => Date;
}

export class TelemetryLogger {
  private readonly transport: TelemetryTransport;
  private readonly defaultTags: TelemetryTags;
  private readonly clock: () => Date;

  constructor(options: TelemetryLoggerOptions = {}) {
    this.transport = options.transport ?? consoleTransport;
    this.defaultTags = options.defaultTags ?? {};
    this.clock = options.clock ?? (() => new Date());
  }

  recordFirstPaint(durationMs: number, tags?: TelemetryTags): Promise<void> {
    this.assertNonNegative(durationMs, 'frontend.first_paint_ms');
    return this.emit('frontend.first_paint_ms', durationMs, 'ms', tags);
  }

  recordImportDuration(durationMs: number, tags?: TelemetryTags): Promise<void> {
    this.assertNonNegative(durationMs, 'import.duration_ms');
    return this.emit('import.duration_ms', durationMs, 'ms', tags);
  }

  recordPublishSuccessRate(rate: number, tags?: TelemetryTags): Promise<void> {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      throw new Error(
        `publish.success_rate must be between 0 and 1. Received ${rate}`,
      );
    }
    return this.emit('publish.success_rate', rate, 'ratio', tags);
  }

  incrementPublishFailure(
    count: number = 1,
    tags?: TelemetryTags,
  ): Promise<void> {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error(
        `publish.failure_count increment must be a positive integer. Received ${count}`,
      );
    }
    return this.emit('publish.failure_count', count, 'count', tags);
  }

  recordDraftEncryptionCheck(
    passed: boolean,
    tags?: TelemetryTags,
  ): Promise<void> {
    return this.emit('draft.encryption_check_pass', passed, undefined, tags);
  }

  private emit(
    metric: TelemetryMetricName,
    value: number | boolean,
    unit: TelemetryEvent['unit'],
    tags?: TelemetryTags,
  ): Promise<void> {
    const event: TelemetryEvent = {
      metric,
      value,
      unit,
      tags: {
        ...this.defaultTags,
        ...(tags ?? {}),
      },
      timestamp: this.clock().toISOString(),
    };

    try {
      const result = this.transport(event);
      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private assertNonNegative(value: number, field: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${field} must be a non-negative number. Received ${value}`);
    }
  }
}
