/**
 * CodeBlock Extension (T032)
 *
 * Provides code block support for the blog editor with language specification.
 *
 * Requirements:
 * - FR-001: System MUST allow composing articles in-browser with code blocks
 * - Support language specification for syntax highlighting
 * - Preserve whitespace and special characters
 * - Integrate with MDX serialization for export
 *
 * Technical decisions (from research.md):
 * - Uses TipTap's built-in CodeBlock extension as base
 * - Configured to support language attribute for syntax highlighting
 * - Ensures proper HTML escaping for security
 */

import CodeBlock from '@tiptap/extension-code-block';

/**
 * CodeBlock extension configured for blog posts
 *
 * Supports language specification for syntax highlighting in published posts.
 * The language attribute maps to CSS classes for highlighting libraries.
 *
 * @example
 * ```typescript
 * import { CodeBlockExtension } from './extensions/code-block';
 * import { Editor } from '@tiptap/core';
 *
 * const editor = new Editor({
 *   extensions: [CodeBlockExtension]
 * });
 *
 * // Create code block with TypeScript syntax
 * editor.commands.setCodeBlock({ language: 'typescript' });
 * editor.commands.insertContent('const x: number = 42;');
 *
 * // Create code block without language
 * editor.commands.setCodeBlock();
 * editor.commands.insertContent('plain code');
 * ```
 */
export const CodeBlockExtension = CodeBlock.configure({
  /**
   * Enable HTML attributes to support language specification
   * This allows the language to be set via the `language` attribute
   */
  HTMLAttributes: {
    class: 'code-block'
  }
});

/**
 * Re-export CodeBlock types for type safety
 */
export type { CodeBlockOptions } from '@tiptap/extension-code-block';
