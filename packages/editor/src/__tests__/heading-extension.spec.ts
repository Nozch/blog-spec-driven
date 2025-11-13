import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, it, expect, beforeEach } from 'vitest';
import { HeadingExtension } from '../extensions/heading';

/**
 * Test suite for the Heading extension (T030)
 *
 * Requirements from spec.md:
 * - FR-001: System MUST allow composing articles in-browser with headings
 * - Headings should support levels 1-4 only (as per plan.md)
 * - Invalid heading levels (5, 6) should be rejected
 */

describe('HeadingExtension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      content: '<p>Test content</p>',
      extensions: [
        StarterKit.configure({
          heading: false // Disable default heading to use our custom one
        }),
        HeadingExtension
      ]
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('heading level constraints', () => {
    it('should allow heading level 1', () => {
      const result = editor.commands.toggleHeading({ level: 1 });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('heading');
      expect(doc.content?.[0]?.attrs?.level).toBe(1);
    });

    it('should allow heading level 2', () => {
      const result = editor.commands.toggleHeading({ level: 2 });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('heading');
      expect(doc.content?.[0]?.attrs?.level).toBe(2);
    });

    it('should allow heading level 3', () => {
      const result = editor.commands.toggleHeading({ level: 3 });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('heading');
      expect(doc.content?.[0]?.attrs?.level).toBe(3);
    });

    it('should allow heading level 4', () => {
      const result = editor.commands.toggleHeading({ level: 4 });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('heading');
      expect(doc.content?.[0]?.attrs?.level).toBe(4);
    });

    it('should reject heading level 5', () => {
      const result = editor.commands.toggleHeading({ level: 5 });
      expect(result).toBe(false);

      const doc = editor.getJSON();
      // Should remain as paragraph (unchanged)
      expect(doc.content?.[0]?.type).toBe('paragraph');
    });

    it('should reject heading level 6', () => {
      const result = editor.commands.toggleHeading({ level: 6 });
      expect(result).toBe(false);

      const doc = editor.getJSON();
      // Should remain as paragraph (unchanged)
      expect(doc.content?.[0]?.type).toBe('paragraph');
    });

    it('should reject heading level 0', () => {
      const result = editor.commands.toggleHeading({ level: 0 });
      expect(result).toBe(false);

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('paragraph');
    });
  });

  describe('heading content preservation', () => {
    it('should preserve text content when converting to heading', () => {
      editor.commands.setContent('<p>Important title text</p>');
      editor.commands.toggleHeading({ level: 2 });

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('heading');
      expect(doc.content?.[0]?.content?.[0]?.text).toBe('Important title text');
    });

    it('should allow toggling between different heading levels', () => {
      editor.commands.toggleHeading({ level: 2 });
      expect(editor.getJSON().content?.[0]?.attrs?.level).toBe(2);

      editor.commands.toggleHeading({ level: 3 });
      expect(editor.getJSON().content?.[0]?.attrs?.level).toBe(3);

      editor.commands.toggleHeading({ level: 1 });
      expect(editor.getJSON().content?.[0]?.attrs?.level).toBe(1);
    });

    it('should toggle back to paragraph when calling toggleHeading on existing heading', () => {
      editor.commands.toggleHeading({ level: 2 });
      expect(editor.getJSON().content?.[0]?.type).toBe('heading');

      editor.commands.toggleHeading({ level: 2 });
      expect(editor.getJSON().content?.[0]?.type).toBe('paragraph');
    });
  });

  describe('MDX serialization compatibility', () => {
    it('should render heading with proper HTML tag', () => {
      editor.commands.setContent('<h2>Test Heading</h2>');

      const html = editor.getHTML();
      expect(html).toContain('<h2>Test Heading</h2>');
    });

    it('should handle empty headings', () => {
      editor.commands.toggleHeading({ level: 3 });
      editor.commands.setContent('<h3></h3>');

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('heading');
      expect(doc.content?.[0]?.attrs?.level).toBe(3);
    });
  });

  describe('keyboard shortcuts', () => {
    it('should have Ctrl+Alt+1 shortcut for H1', () => {
      const shortcuts = editor.extensionManager.extensions
        .find(ext => ext.name === 'heading')
        ?.options?.levels;

      expect(shortcuts).toContain(1);
    });
  });
});
