/**
 * Appearance Extension (T035)
 *
 * Provides article appearance controls for font size and left padding.
 *
 * Requirements:
 * - FR-009: Article appearance controls MUST persist font size and left padding settings
 * - Font size: 14-24px range (clamped)
 * - Left padding: 0-64px range (clamped)
 * - Settings stored per article
 *
 * Technical decisions:
 * - Implemented as TipTap extension with storage
 * - Uses CSS custom properties for live preview
 * - Settings persist in extension storage
 * - Validation and clamping on set
 */

import { Extension } from '@tiptap/core';

/**
 * Font size constraints (in pixels)
 */
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 16;

/**
 * Left padding constraints (in pixels)
 */
const MIN_LEFT_PADDING = 0;
const MAX_LEFT_PADDING = 64;
const DEFAULT_LEFT_PADDING = 0;

/**
 * Clamps a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(value, min), max));
}

/**
 * Validates and normalizes a numeric value
 * @param value - Value to validate
 * @param defaultValue - Default if invalid
 * @returns Valid number or default
 */
function validateNumber(value: any, defaultValue: number): number {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Appearance settings interface
 */
export interface AppearanceSettings {
  fontSize: number;
  leftPadding: number;
}

/**
 * Appearance extension for blog editor
 *
 * Manages article-level appearance settings:
 * - Font size (14-24px, default 16px)
 * - Left padding (0-64px, default 0px)
 *
 * Settings are:
 * - Validated and clamped to allowed ranges
 * - Persisted in extension storage
 * - Applied via CSS custom properties
 * - Available for export to MDX/JSON
 *
 * @example
 * ```typescript
 * import { AppearanceExtension } from './extensions/appearance';
 * import { Editor } from '@tiptap/core';
 *
 * const editor = new Editor({
 *   extensions: [AppearanceExtension]
 * });
 *
 * // Set both font size and padding
 * editor.commands.setAppearance({
 *   fontSize: 18,
 *   leftPadding: 32
 * });
 *
 * // Set only font size
 * editor.commands.setAppearance({ fontSize: 20 });
 *
 * // Get current appearance
 * const settings = editor.commands.getAppearance();
 *
 * // Reset to defaults
 * editor.commands.resetAppearance();
 * ```
 */
export const AppearanceExtension = Extension.create({
  name: 'appearance',

  addStorage() {
    return {
      fontSize: DEFAULT_FONT_SIZE,
      leftPadding: DEFAULT_LEFT_PADDING
    };
  },

  addCommands() {
    const applyStyles = (editor: any, storage: any) => {
      const element = editor.view.dom as HTMLElement;
      if (element) {
        element.style.setProperty('--editor-font-size', `${storage.fontSize}px`);
        element.style.setProperty('--editor-left-padding', `${storage.leftPadding}px`);
      }
    };

    return {
      /**
       * Set appearance settings
       * @param settings - Partial appearance settings to update
       */
      setAppearance:
        (settings: Partial<AppearanceSettings>) =>
        ({ editor }) => {
          const { storage } = this;

          // Validate and clamp fontSize if provided
          if (settings.fontSize !== undefined) {
            const validatedSize = validateNumber(settings.fontSize, DEFAULT_FONT_SIZE);
            storage.fontSize = clamp(validatedSize, MIN_FONT_SIZE, MAX_FONT_SIZE);
          }

          // Validate and clamp leftPadding if provided
          if (settings.leftPadding !== undefined) {
            const validatedPadding = validateNumber(settings.leftPadding, DEFAULT_LEFT_PADDING);
            storage.leftPadding = clamp(validatedPadding, MIN_LEFT_PADDING, MAX_LEFT_PADDING);
          }

          // Apply CSS custom properties to editor element
          applyStyles(editor, storage);

          return true;
        },

      /**
       * Get current appearance settings
       * @returns Current appearance settings
       */
      getAppearance:
        () =>
        () => {
          const { storage } = this;
          return {
            fontSize: storage.fontSize,
            leftPadding: storage.leftPadding
          };
        },

      /**
       * Reset appearance to defaults
       */
      resetAppearance:
        () =>
        ({ editor }) => {
          const { storage } = this;

          storage.fontSize = DEFAULT_FONT_SIZE;
          storage.leftPadding = DEFAULT_LEFT_PADDING;

          // Apply CSS custom properties
          applyStyles(editor, storage);

          return true;
        }
    };
  },

  onCreate() {
    // Apply initial styles when editor is created
    const element = this.editor.view.dom as HTMLElement;
    if (element) {
      element.style.setProperty('--editor-font-size', `${this.storage.fontSize}px`);
      element.style.setProperty('--editor-left-padding', `${this.storage.leftPadding}px`);
    }
  }
});

/**
 * Export appearance constants for external use
 */
export const APPEARANCE_CONSTRAINTS = {
  fontSize: {
    min: MIN_FONT_SIZE,
    max: MAX_FONT_SIZE,
    default: DEFAULT_FONT_SIZE
  },
  leftPadding: {
    min: MIN_LEFT_PADDING,
    max: MAX_LEFT_PADDING,
    default: DEFAULT_LEFT_PADDING
  }
} as const;
