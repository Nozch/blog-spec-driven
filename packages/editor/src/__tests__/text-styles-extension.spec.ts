import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';

import { createExtensionKit } from '../extensions';

/**
 * Text styles extension tests (T031)
 *
 * These tests intentionally disable StarterKit's built-in bold/italic marks to
 * ensure our custom text styles extension (to be implemented in T031) provides
 * the required formatting controls from FR-001.
 */

const buildEditor = (content = '<p>Stylish text</p>') =>
  new Editor({
    content,
    extensions: [
      StarterKit.configure({
        heading: false,
        image: false,
        bold: false,
        italic: false
      }),
      ...createExtensionKit()
    ]
  });

describe('TextStylesExtension (T031)', () => {
  it('toggles bold marks on the current selection', () => {
    const editor = buildEditor();
    try {
      expect(typeof editor.commands.toggleBold).toBe('function');

      const applied = editor.chain().focus().selectAll().toggleBold().run();
      expect(applied).toBe(true);

      const doc = editor.getJSON();
      const marks = doc.content?.[0]?.content?.[0]?.marks ?? [];
      expect(marks.some((mark) => mark.type === 'bold')).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it('toggles italic marks and can remove them when run twice', () => {
    const editor = buildEditor('<p>Italic focus</p>');
    try {
      expect(typeof editor.commands.toggleItalic).toBe('function');

      const applied = editor.chain().focus().selectAll().toggleItalic().run();
      expect(applied).toBe(true);
      let doc = editor.getJSON();
      let marks = doc.content?.[0]?.content?.[0]?.marks ?? [];
      expect(marks.some((mark) => mark.type === 'italic')).toBe(true);

      const removed = editor.chain().focus().selectAll().toggleItalic().run();
      expect(removed).toBe(true);
      doc = editor.getJSON();
      marks = doc.content?.[0]?.content?.[0]?.marks ?? [];
      expect(marks.some((mark) => mark.type === 'italic')).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('allows combining bold and italic for the same text span', () => {
    const editor = buildEditor('<p>Strong emphasis</p>');
    try {
      const ok = editor.chain().focus().selectAll().toggleBold().toggleItalic().run();
      expect(ok).toBe(true);

      const doc = editor.getJSON();
      const marks = doc.content?.[0]?.content?.[0]?.marks ?? [];
      const markTypes = marks.map((mark) => mark.type).sort();
      expect(markTypes).toEqual(['bold', 'italic']);

      const html = editor.getHTML();
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
    } finally {
      editor.destroy();
    }
  });
});
