import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditor } from '../editor';
import { getAppearanceSettings } from '../extensions';

/**
 * Test suite for the Editor Factory (T036)
 *
 * Requirements from spec.md and tasks.md:
 * - FR-001: System MUST allow composing articles with all formatting controls
 * - T036: Implement TipTap editor factory with all extensions (T030-T035)
 * - Must integrate: Heading, TextStyles, CodeBlock, ImageEmbed, VideoEmbed, Appearance
 * - Factory should provide consistent, configured editor instances
 */

describe('Editor Factory', () => {
  let editor: Editor;

  afterEach(() => {
    if (editor) {
      editor.destroy();
    }
  });

  describe('editor creation', () => {
    it('should create an editor instance with default content', () => {
      editor = createEditor();

      expect(editor).toBeInstanceOf(Editor);
      expect(editor.isDestroyed).toBe(false);
    });

    it('should create an editor with custom MDX content', () => {
      editor = createEditor({ mdx: '# Hello World\n\nCustom content' });

      const html = editor.getHTML();
      expect(html).toContain('Custom content');
    });

    it('should create an editor with TipTap JSON content', () => {
      editor = createEditor({
        tiptap: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'JSON content' }] }]
        }
      });

      const html = editor.getHTML();
      expect(html).toContain('JSON content');
    });
  });

  describe('extension integration', () => {
    beforeEach(() => {
      editor = createEditor();
    });

    it('should include HeadingExtension (T030)', () => {
      const hasHeading = editor.extensionManager.extensions.some(
        ext => ext.name === 'heading'
      );
      expect(hasHeading).toBe(true);
    });

    it('should include Bold extension from TextStyles (T031)', () => {
      const hasBold = editor.extensionManager.extensions.some(
        ext => ext.name === 'bold'
      );
      expect(hasBold).toBe(true);
    });

    it('should include Italic extension from TextStyles (T031)', () => {
      const hasItalic = editor.extensionManager.extensions.some(
        ext => ext.name === 'italic'
      );
      expect(hasItalic).toBe(true);
    });

    it('should include CodeBlock extension (T032)', () => {
      const hasCodeBlock = editor.extensionManager.extensions.some(
        ext => ext.name === 'codeBlock'
      );
      expect(hasCodeBlock).toBe(true);
    });

    it('should include ImageFigure extension (T033)', () => {
      const hasImageFigure = editor.extensionManager.extensions.some(
        ext => ext.name === 'imageFigure'
      );
      expect(hasImageFigure).toBe(true);
    });

    it('should include VideoEmbed extension (T034)', () => {
      const hasVideoEmbed = editor.extensionManager.extensions.some(
        ext => ext.name === 'videoEmbed'
      );
      expect(hasVideoEmbed).toBe(true);
    });

    it('should include Appearance extension (T035)', () => {
      const hasAppearance = editor.extensionManager.extensions.some(
        ext => ext.name === 'appearanceControls'
      );
      expect(hasAppearance).toBe(true);
    });
  });

  describe('functional integration tests', () => {
    beforeEach(() => {
      editor = createEditor({ mdx: 'Test content' });
    });

    it('should support heading operations (T030 integration)', () => {
      const result = editor.commands.toggleHeading({ level: 2 });
      expect(result).toBe(true);

      const json = editor.getJSON();
      expect(json.content?.[0]?.type).toBe('heading');
      expect(json.content?.[0]?.attrs?.level).toBe(2);
    });

    it('should support bold text formatting (T031 integration)', () => {
      editor.commands.setTextSelection({ from: 1, to: 5 });
      const result = editor.commands.toggleBold();
      expect(result).toBe(true);

      const html = editor.getHTML();
      expect(html).toContain('<strong>');
    });

    it('should support italic text formatting (T031 integration)', () => {
      editor.commands.setTextSelection({ from: 1, to: 5 });
      const result = editor.commands.toggleItalic();
      expect(result).toBe(true);

      const html = editor.getHTML();
      expect(html).toContain('<em>');
    });

    it('should support code block insertion (T032 integration)', () => {
      const result = editor.commands.toggleCodeBlock();
      expect(result).toBe(true);

      const json = editor.getJSON();
      expect(json.content?.[0]?.type).toBe('codeBlock');
    });

    it('should support appearance settings (T035 integration)', () => {
      const result = editor.commands.setAppearance({
        fontSize: 18,
        leftPadding: 24
      });
      expect(result).toBe(true);

      const appearance = getAppearanceSettings(editor);
      expect(appearance.fontSize).toBe(18);
      expect(appearance.leftPadding).toBe(24);
    });
  });

  describe('multi-extension composition', () => {
    beforeEach(() => {
      editor = createEditor({ mdx: 'Test heading' });
    });

    it('should allow combining heading with text styles', () => {
      editor.commands.toggleHeading({ level: 2 });
      editor.commands.setTextSelection({ from: 1, to: 5 });
      editor.commands.toggleBold();

      const html = editor.getHTML();
      expect(html).toContain('<h2>');
      expect(html).toContain('<strong>');
    });

    it('should persist appearance while editing content', () => {
      editor.commands.setAppearance({ fontSize: 20, leftPadding: 32 });
      editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New content' }] }] });
      editor.commands.toggleHeading({ level: 3 });

      const appearance = getAppearanceSettings(editor);
      expect(appearance.fontSize).toBe(20);
      expect(appearance.leftPadding).toBe(32);
    });
  });

  describe('configuration options', () => {
    it('should accept editable configuration', () => {
      editor = createEditor({ editorOptions: { editable: false } });

      expect(editor.isEditable).toBe(false);
    });

    it('should accept autofocus configuration', () => {
      editor = createEditor({ editorOptions: { autofocus: true } });

      // Autofocus doesn't work in test environment without real DOM
      // Just verify the editor was created successfully
      expect(editor).toBeInstanceOf(Editor);
    });

    it('should accept custom appearance defaults', () => {
      editor = createEditor({
        appearance: { fontSize: 20, leftPadding: 16 }
      });

      const appearance = getAppearanceSettings(editor);
      expect(appearance.fontSize).toBe(20);
      expect(appearance.leftPadding).toBe(16);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle invalid MDX gracefully', () => {
      expect(() => {
        editor = createEditor({ mdx: '<invalid>malformed</invalid>' });
      }).not.toThrow();
    });

    it('should create editor with undefined configuration', () => {
      expect(() => {
        editor = createEditor(undefined);
      }).not.toThrow();

      expect(editor).toBeInstanceOf(Editor);
    });

    it('should create editor with empty configuration object', () => {
      expect(() => {
        editor = createEditor({});
      }).not.toThrow();

      expect(editor).toBeInstanceOf(Editor);
    });
  });

  describe('lifecycle management', () => {
    it('should properly destroy created editor', () => {
      editor = createEditor();
      editor.destroy();

      expect(editor.isDestroyed).toBe(true);
    });

    it('should allow creating multiple independent editors', () => {
      const editor1 = createEditor({ mdx: 'Editor 1 content' });
      const editor2 = createEditor({ mdx: 'Editor 2 content' });

      expect(editor1.getHTML()).toContain('Editor 1');
      expect(editor2.getHTML()).toContain('Editor 2');

      editor1.destroy();
      editor2.destroy();
    });
  });
});
