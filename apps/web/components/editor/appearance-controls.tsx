/**
 * AppearanceControls Component (T040)
 *
 * UI component for controlling article appearance settings
 * Located at: apps/web/components/editor/appearance-controls.tsx
 *
 * Requirements:
 * - FR-009: Article appearance controls MUST persist font size and left padding settings
 * - Font size: 14-24px range with slider
 * - Left padding: 0-64px range with slider
 * - Live preview of values
 * - Reset to defaults functionality
 *
 * Technical decisions:
 * - Uses native HTML range inputs for broad compatibility
 * - Controlled components with React state
 * - Inline styles for simplicity (can be migrated to CSS modules later)
 * - Accessible labels and ARIA attributes
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// Appearance constraints from FR-009 and T035
const FONT_SIZE_MIN = 14;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_DEFAULT = 16;
const FONT_SIZE_STEP = 1;

const LEFT_PADDING_MIN = 0;
const LEFT_PADDING_MAX = 64;
const LEFT_PADDING_DEFAULT = 0;
const LEFT_PADDING_STEP = 4;

export interface AppearanceControlsProps {
  /**
   * Current font size in pixels (14-24px)
   */
  fontSize?: number;

  /**
   * Current left padding in pixels (0-64px)
   */
  leftPadding?: number;

  /**
   * Callback triggered when appearance settings change
   */
  onChange?: (settings: {
    fontSize: number;
    leftPadding: number;
  }) => void;

  /**
   * Additional CSS class name
   */
  className?: string;
}

/**
 * Clamp a value to a specified range
 */
const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Validate and normalize a numeric value
 */
const validateNumber = (value: any, defaultValue: number, min: number, max: number): number => {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) {
    return defaultValue;
  }
  return clamp(num, min, max);
};

/**
 * AppearanceControls component for blog article appearance customization
 *
 * Provides sliders for:
 * - Font size (14-24px, default 16px)
 * - Left padding (0-64px, default 0px)
 *
 * Features:
 * - Live preview of values
 * - Reset to defaults button
 * - Accessible labels and keyboard navigation
 * - Value clamping to valid ranges
 *
 * @example
 * ```tsx
 * <AppearanceControls
 *   fontSize={18}
 *   leftPadding={32}
 *   onChange={(settings) => {
 *     editor.commands.setAppearance(settings);
 *   }}
 * />
 * ```
 */
const AppearanceControls: React.FC<AppearanceControlsProps> = ({
  fontSize: fontSizeProp,
  leftPadding: leftPaddingProp,
  onChange,
  className
}) => {
  // Validate and normalize initial values
  const initialFontSize = validateNumber(
    fontSizeProp,
    FONT_SIZE_DEFAULT,
    FONT_SIZE_MIN,
    FONT_SIZE_MAX
  );
  const initialLeftPadding = validateNumber(
    leftPaddingProp,
    LEFT_PADDING_DEFAULT,
    LEFT_PADDING_MIN,
    LEFT_PADDING_MAX
  );

  // Internal state for controlled inputs
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [leftPadding, setLeftPadding] = useState(initialLeftPadding);

  // Sync with prop changes
  useEffect(() => {
    setFontSize(
      validateNumber(fontSizeProp, FONT_SIZE_DEFAULT, FONT_SIZE_MIN, FONT_SIZE_MAX)
    );
  }, [fontSizeProp]);

  useEffect(() => {
    setLeftPadding(
      validateNumber(leftPaddingProp, LEFT_PADDING_DEFAULT, LEFT_PADDING_MIN, LEFT_PADDING_MAX)
    );
  }, [leftPaddingProp]);

  // Handle font size change
  const handleFontSizeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(event.target.value, 10);
      const clamped = clamp(value, FONT_SIZE_MIN, FONT_SIZE_MAX);
      setFontSize(clamped);

      if (onChange) {
        try {
          onChange({
            fontSize: clamped,
            leftPadding
          });
        } catch (error) {
          console.error('Error in onChange handler:', error);
        }
      }
    },
    [leftPadding, onChange]
  );

  // Handle left padding change
  const handleLeftPaddingChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(event.target.value, 10);
      const clamped = clamp(value, LEFT_PADDING_MIN, LEFT_PADDING_MAX);
      setLeftPadding(clamped);

      if (onChange) {
        try {
          onChange({
            fontSize,
            leftPadding: clamped
          });
        } catch (error) {
          console.error('Error in onChange handler:', error);
        }
      }
    },
    [fontSize, onChange]
  );

  // Handle reset to defaults
  const handleReset = useCallback(() => {
    setFontSize(FONT_SIZE_DEFAULT);
    setLeftPadding(LEFT_PADDING_DEFAULT);

    if (onChange) {
      try {
        onChange({
          fontSize: FONT_SIZE_DEFAULT,
          leftPadding: LEFT_PADDING_DEFAULT
        });
      } catch (error) {
        console.error('Error in onChange handler:', error);
      }
    }
  }, [onChange]);

  return (
    <div
      className={className}
      style={{
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label
            htmlFor="font-size-slider"
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151'
            }}
          >
            Font Size
          </label>
          <span
            style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              fontWeight: 500
            }}
          >
            {fontSize}px
          </span>
        </div>
        <input
          id="font-size-slider"
          type="range"
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={FONT_SIZE_STEP}
          value={fontSize}
          onChange={handleFontSizeChange}
          aria-label="Font size"
          style={{
            width: '100%',
            cursor: 'pointer'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
          <span>{FONT_SIZE_MIN}px</span>
          <span>{FONT_SIZE_MAX}px</span>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label
            htmlFor="left-padding-slider"
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151'
            }}
          >
            Left Padding
          </label>
          <span
            style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              fontWeight: 500
            }}
          >
            {leftPadding}px
          </span>
        </div>
        <input
          id="left-padding-slider"
          type="range"
          min={LEFT_PADDING_MIN}
          max={LEFT_PADDING_MAX}
          step={LEFT_PADDING_STEP}
          value={leftPadding}
          onChange={handleLeftPaddingChange}
          aria-label="Left padding"
          style={{
            width: '100%',
            cursor: 'pointer'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
          <span>{LEFT_PADDING_MIN}px</span>
          <span>{LEFT_PADDING_MAX}px</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleReset}
        style={{
          width: '100%',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#374151',
          backgroundColor: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f3f4f6';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#ffffff';
        }}
      >
        Reset to Defaults
      </button>
    </div>
  );
};

export default AppearanceControls;
