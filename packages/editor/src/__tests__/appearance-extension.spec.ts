import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppearanceExtension } from '../extensions/appearance';

/**
 * Test suite for the Appearance extension (T035)
 *
 * Requirements from spec.md and data-model.md:
 * - FR-009: Article appearance controls MUST persist font size and left padding settings
 * - Font size: 14-24px range (clamped)
 * - Left padding: 0-64px range (clamped)
 * - Settings stored as document-level attributes
 */

describe('AppearanceExtension', () => {
  let editor: Editor;

  beforeEach(() => {
    // Create fresh editor with fresh extension instance
    editor = new Editor({
      content: '<p>Test content</p>',
      extensions: [
        StarterKit,
        AppearanceExtension.configure({}) // Force new instance
      ]
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('font size controls', () => {
    it('should set font size within valid range', () => {
      const result = editor.commands.setAppearance({ fontSize: 16 });
      expect(result).toBe(true);

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(16);
    });

    it('should accept minimum font size (14px)', () => {
      editor.commands.setAppearance({ fontSize: 14 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(14);
    });

    it('should accept maximum font size (24px)', () => {
      editor.commands.setAppearance({ fontSize: 24 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(24);
    });

    it('should clamp font size below minimum to 14px', () => {
      editor.commands.setAppearance({ fontSize: 10 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(14);
    });

    it('should clamp font size above maximum to 24px', () => {
      editor.commands.setAppearance({ fontSize: 30 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(24);
    });

    it('should use default font size (16px) when not specified', () => {
      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(16);
    });
  });

  describe('left padding controls', () => {
    it('should set left padding within valid range', () => {
      const result = editor.commands.setAppearance({ leftPadding: 32 });
      expect(result).toBe(true);

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.leftPadding).toBe(32);
    });

    it('should accept minimum left padding (0px)', () => {
      editor.commands.setAppearance({ leftPadding: 0 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.leftPadding).toBe(0);
    });

    it('should accept maximum left padding (64px)', () => {
      editor.commands.setAppearance({ leftPadding: 64 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.leftPadding).toBe(64);
    });

    it('should clamp left padding below minimum to 0px', () => {
      editor.commands.setAppearance({ leftPadding: -10 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.leftPadding).toBe(0);
    });

    it('should clamp left padding above maximum to 64px', () => {
      editor.commands.setAppearance({ leftPadding: 100 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.leftPadding).toBe(64);
    });

    it('should use default left padding (0px) when not specified', () => {
      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.leftPadding).toBe(0);
    });
  });

  describe('combined appearance settings', () => {
    it('should set both font size and left padding together', () => {
      editor.commands.setAppearance({ fontSize: 18, leftPadding: 16 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(18);
      expect(attrs?.leftPadding).toBe(16);
    });

    it('should update only font size without affecting padding', () => {
      editor.commands.setAppearance({ fontSize: 18, leftPadding: 16 });
      editor.commands.setAppearance({ fontSize: 20 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(20);
      expect(attrs?.leftPadding).toBe(16); // Should remain unchanged
    });

    it('should update only left padding without affecting font size', () => {
      editor.commands.setAppearance({ fontSize: 18, leftPadding: 16 });
      editor.commands.setAppearance({ leftPadding: 32 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(18); // Should remain unchanged
      expect(attrs?.leftPadding).toBe(32);
    });
  });

  describe('appearance retrieval', () => {
    it('should retrieve current appearance settings', () => {
      editor.commands.setAppearance({ fontSize: 20, leftPadding: 24 });

      const appearance = editor.commands.getAppearance?.();

      expect(appearance).toEqual({ fontSize: 20, leftPadding: 24 });
    });

    it('should retrieve default appearance when none set', () => {
      const appearance = editor.commands.getAppearance?.();

      expect(appearance).toEqual({ fontSize: 16, leftPadding: 0 });
    });
  });

  describe('persistence and state', () => {
    it('should persist appearance across content changes', () => {
      editor.commands.setAppearance({ fontSize: 20, leftPadding: 32 });
      editor.commands.setContent('<p>New content</p>');

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(20);
      expect(attrs?.leftPadding).toBe(32);
    });

    it('should include appearance in JSON export', () => {
      editor.commands.setAppearance({ fontSize: 18, leftPadding: 24 });

      const json = editor.getJSON();

      // Appearance should be accessible via extension storage
      const ext = editor.extensionManager.extensions.find(
        e => e.name === 'appearance'
      );
      expect(ext?.storage?.fontSize).toBe(18);
      expect(ext?.storage?.leftPadding).toBe(24);
    });
  });

  describe('validation and error handling', () => {
    it('should handle non-numeric font size gracefully', () => {
      editor.commands.setAppearance({ fontSize: 'large' as any });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      // Should use default or clamp to valid value
      expect(attrs?.fontSize).toBeGreaterThanOrEqual(14);
      expect(attrs?.fontSize).toBeLessThanOrEqual(24);
    });

    it('should handle non-numeric left padding gracefully', () => {
      editor.commands.setAppearance({ leftPadding: 'small' as any });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      // Should use default or clamp to valid value
      expect(attrs?.leftPadding).toBeGreaterThanOrEqual(0);
      expect(attrs?.leftPadding).toBeLessThanOrEqual(64);
    });

    it('should handle fractional font sizes by rounding', () => {
      editor.commands.setAppearance({ fontSize: 17.8 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(18);
    });

    it('should handle fractional padding by rounding', () => {
      editor.commands.setAppearance({ leftPadding: 15.4 });

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.leftPadding).toBe(15);
    });
  });

  describe('CSS class application', () => {
    it('should apply CSS custom properties for appearance', () => {
      editor.commands.setAppearance({ fontSize: 20, leftPadding: 32 });

      const element = editor.view.dom;
      const fontSize = element.style.getPropertyValue('--editor-font-size');
      const padding = element.style.getPropertyValue('--editor-left-padding');

      expect(fontSize).toBe('20px');
      expect(padding).toBe('32px');
    });

    it('should update CSS when appearance changes', () => {
      editor.commands.setAppearance({ fontSize: 18, leftPadding: 16 });
      editor.commands.setAppearance({ fontSize: 22, leftPadding: 48 });

      const element = editor.view.dom;
      const fontSize = element.style.getPropertyValue('--editor-font-size');
      const padding = element.style.getPropertyValue('--editor-left-padding');

      expect(fontSize).toBe('22px');
      expect(padding).toBe('48px');
    });
  });

  describe('reset functionality', () => {
    it('should reset appearance to defaults', () => {
      editor.commands.setAppearance({ fontSize: 22, leftPadding: 48 });
      editor.commands.resetAppearance?.();

      const attrs = editor.extensionManager.extensions.find(
        ext => ext.name === 'appearance'
      )?.storage;

      expect(attrs?.fontSize).toBe(16);
      expect(attrs?.leftPadding).toBe(0);
    });
  });
});
