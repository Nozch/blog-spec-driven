/**
 * Heading Extension (T030)
 *
 * Provides heading support for the blog editor with levels 1-4.
 *
 * Requirements:
 * - FR-001: System MUST allow composing articles in-browser with headings
 * - Heading levels restricted to 1-4 (h1, h2, h3, h4)
 * - Levels 5-6 are explicitly rejected to maintain consistency
 *
 * Technical decisions (from research.md):
 * - Uses TipTap's built-in Heading extension as base
 * - Configured to only allow levels 1-4
 * - Integrates with MDX serialization for export
 */

import Heading from '@tiptap/extension-heading';

/**
 * Heading extension configured for blog posts
 *
 * Restricts heading levels to 1-4 as per spec requirements.
 * This ensures consistent document structure and prevents
 * excessive nesting depth.
 *
 * @example
 * ```typescript
 * import { HeadingExtension } from './extensions/heading';
 * import { Editor } from '@tiptap/core';
 *
 * const editor = new Editor({
 *   extensions: [HeadingExtension]
 * });
 *
 * // Set heading level 2
 * editor.commands.toggleHeading({ level: 2 });
 *
 * // Invalid level - will be rejected
 * editor.commands.toggleHeading({ level: 5 }); // returns false
 * ```
 */
export const HeadingExtension = Heading.configure({
  levels: [1, 2, 3, 4]
});

/**
 * Re-export Heading type for type safety
 */
export type { Level as HeadingLevel } from '@tiptap/extension-heading';
