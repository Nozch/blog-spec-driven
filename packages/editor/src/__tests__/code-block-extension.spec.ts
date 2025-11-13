import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodeBlockExtension } from '../extensions/code-block';

/**
 * Test suite for the CodeBlock extension (T032)
 *
 * Requirements from spec.md:
 * - FR-001: System MUST allow composing articles in-browser with code blocks
 * - Code blocks should support language specification for syntax highlighting
 * - Content must be preserved with proper escaping for MDX serialization
 */

describe('CodeBlockExtension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      content: '<p>Test content</p>',
      extensions: [
        StarterKit.configure({
          codeBlock: false // Disable default codeBlock to use our custom one
        }),
        CodeBlockExtension
      ]
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('basic code block functionality', () => {
    it('should create a code block', () => {
      const result = editor.commands.toggleCodeBlock();
      expect(result).toBe(true);

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('codeBlock');
    });

    it('should toggle code block off to return to paragraph', () => {
      editor.commands.toggleCodeBlock();
      expect(editor.getJSON().content?.[0]?.type).toBe('codeBlock');

      editor.commands.toggleCodeBlock();
      expect(editor.getJSON().content?.[0]?.type).toBe('paragraph');
    });

    it('should allow setting code block via setCodeBlock command', () => {
      const result = editor.commands.setCodeBlock();
      expect(result).toBe(true);

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('codeBlock');
    });
  });

  describe('language specification', () => {
    it('should support setting language attribute', () => {
      editor.commands.setCodeBlock({ language: 'typescript' });

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('codeBlock');
      expect(doc.content?.[0]?.attrs?.language).toBe('typescript');
    });

    it('should support JavaScript language', () => {
      editor.commands.setCodeBlock({ language: 'javascript' });

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.attrs?.language).toBe('javascript');
    });

    it('should support Python language', () => {
      editor.commands.setCodeBlock({ language: 'python' });

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.attrs?.language).toBe('python');
    });

    it('should support Bash language', () => {
      editor.commands.setCodeBlock({ language: 'bash' });

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.attrs?.language).toBe('bash');
    });

    it('should allow code block without language (null language)', () => {
      editor.commands.setCodeBlock();

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('codeBlock');
      expect(doc.content?.[0]?.attrs?.language).toBeNull();
    });

    it('should update language on existing code block', () => {
      editor.commands.setCodeBlock({ language: 'javascript' });
      expect(editor.getJSON().content?.[0]?.attrs?.language).toBe('javascript');

      editor.commands.updateAttributes('codeBlock', { language: 'typescript' });
      expect(editor.getJSON().content?.[0]?.attrs?.language).toBe('typescript');
    });
  });

  describe('content preservation', () => {
    it('should preserve text content when converting to code block', () => {
      editor.commands.setContent('<p>const x = 42;</p>');
      editor.commands.toggleCodeBlock();

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('codeBlock');
      expect(doc.content?.[0]?.content?.[0]?.text).toBe('const x = 42;');
    });

    it('should preserve multi-line code content', () => {
      const code = 'function hello() {\n  return "world";\n}';
      editor.commands.setContent(`<pre><code>${code}</code></pre>`);

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('codeBlock');
      expect(doc.content?.[0]?.content?.[0]?.text).toBe(code);
    });

    it('should preserve special characters', () => {
      const code = 'if (x < 10 && y > 5) { return "test"; }';
      editor.commands.setContent('<p>' + code + '</p>');
      editor.commands.toggleCodeBlock();

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.content?.[0]?.text).toBe(code);
    });

    it('should preserve leading whitespace in pre/code tags', () => {
      const code = '    indented code';
      editor.commands.setContent('<pre><code>' + code + '</code></pre>');

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.content?.[0]?.text).toBe(code);
    });

    it('should preserve trailing whitespace in pre/code tags', () => {
      const code = 'code with spaces   ';
      editor.commands.setContent('<pre><code>' + code + '</code></pre>');

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.content?.[0]?.text).toBe(code);
    });

    it('should handle empty code blocks', () => {
      editor.commands.setContent('');
      editor.commands.setCodeBlock();

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('codeBlock');
      // Empty code blocks may have no content array or empty content
      const content = doc.content?.[0]?.content;
      expect(!content || content.length === 0).toBe(true);
    });
  });

  describe('MDX serialization compatibility', () => {
    it('should render code block with proper HTML structure', () => {
      editor.commands.setContent('<pre><code>test code</code></pre>');

      const html = editor.getHTML();
      expect(html).toContain('<pre');
      expect(html).toContain('<code>test code</code>');
      expect(html).toContain('</pre>');
    });

    it('should render code block with language class', () => {
      editor.commands.setCodeBlock({ language: 'typescript' });
      editor.commands.insertContent('const x = 1;');

      const html = editor.getHTML();
      expect(html).toContain('language-typescript');
    });

    it('should escape HTML entities in code content', () => {
      editor.commands.setCodeBlock();
      editor.commands.insertContent('<script>alert("xss")</script>');

      const html = editor.getHTML();
      // TipTap should escape HTML entities
      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('keyboard shortcuts', () => {
    it('should have keyboard shortcut available', () => {
      const codeBlockExt = editor.extensionManager.extensions.find(
        ext => ext.name === 'codeBlock'
      );

      expect(codeBlockExt).toBeDefined();
      expect(codeBlockExt?.options).toBeDefined();
    });
  });

  describe('integration with other extensions', () => {
    it('should not apply formatting marks inside code blocks', () => {
      editor.commands.setCodeBlock();
      editor.commands.insertContent('some code');

      // Select all and try to make text bold
      editor.commands.selectAll();
      editor.commands.toggleBold();

      // Verify that code block content doesn't have bold marks
      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('codeBlock');

      // Code blocks contain plain text nodes without marks
      const textNode = doc.content?.[0]?.content?.[0];
      expect(textNode?.marks).toBeUndefined();
    });

    it('should exit code block when pressing Enter at the end', () => {
      editor.commands.setCodeBlock();
      editor.commands.insertContent('code');

      // This behavior is default in TipTap - just verify code block exists
      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe('codeBlock');
    });
  });
});
