/**
 * Extension exports for the blog editor
 *
 * This module organizes TipTap extensions for the Personal Blog Publishing Flow.
 * Each extension is in a separate file for maintainability and testability.
 *
 * Extensions implemented:
 * - T030: Heading extension (levels 1-4) ✓
 * - T031: Text styles (bold/italic) ✓
 * - T032: Code blocks ✓
 * - T033: Image embeds with size validation ✓
 * - T034: Video embeds with provider allowlist ✓
 * - T035: Appearance controls (font-size, left-padding) ✓
 */

export { HeadingExtension, type HeadingLevel } from './heading';
export { TextStylesExtension } from './text-styles';
export { CodeBlockExtension, type CodeBlockOptions } from './code-block';
export {
  ImageEmbedExtension,
  type ImageOptions,
  type ImageEmbedAttributes
} from './image-figure';
export {
  VideoEmbedExtension,
  type VideoEmbedAttributes
} from './video-embed';
export {
  AppearanceExtension,
  type AppearanceSettings,
  APPEARANCE_CONSTRAINTS
} from './appearance';
