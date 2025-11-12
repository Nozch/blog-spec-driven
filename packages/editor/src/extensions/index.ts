/**
 * Extension exports for the blog editor
 *
 * This module organizes TipTap extensions for the Personal Blog Publishing Flow.
 * Each extension is in a separate file for maintainability and testability.
 *
 * Extensions implemented:
 * - T030: Heading extension (levels 1-4)
 * - T031: Text styles (bold/italic)
 * - T032: Code blocks - TODO
 * - T033: Image embeds - TODO
 * - T034: Video embeds - TODO
 * - T035: Appearance controls - TODO
 */

export { HeadingExtension, type HeadingLevel } from './heading';
export { TextStylesExtension } from './text-styles';
