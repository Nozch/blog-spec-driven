/**
 * Image Embed Extension (T033)
 *
 * Provides image embed support for the blog editor with size validation.
 *
 * Requirements:
 * - FR-001: System MUST allow composing articles in-browser with image embeds
 * - FR-002: System MUST validate referenced media sizes (≤8 MB)
 * - Support src, alt, width, and height attributes
 * - Clamp dimensions to reasonable maximums (2000x2000px)
 * - Sanitize URLs to prevent XSS attacks
 *
 * Technical decisions (from research.md):
 * - Uses TipTap's built-in Image extension as base
 * - Configured to validate and sanitize image URLs
 * - Dimensions are clamped for performance and layout stability
 * - File size validation happens at upload/import time, not in editor
 */

import Image from '@tiptap/extension-image';

/**
 * Maximum dimension for images (width or height)
 * Prevents layout issues and ensures reasonable file sizes
 */
const MAX_DIMENSION = 2000;

/**
 * Allowed URL protocols for image sources
 * Prevents XSS via javascript: or data: URLs
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Sanitizes and validates an image URL
 * @param url - The URL to validate
 * @returns Sanitized URL or null if invalid
 */
function sanitizeImageURL(url: string | null | undefined): string | null {
  if (!url) return null;

  // Allow relative URLs (start with /)
  if (url.startsWith('/')) return url;

  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      console.warn(`Rejected image URL with protocol: ${parsed.protocol}`);
      return null;
    }

    return url;
  } catch (e) {
    // If URL parsing fails, treat as relative path
    if (url.startsWith('./') || !url.includes(':')) {
      return url;
    }
    console.warn(`Invalid image URL: ${url}`);
    return null;
  }
}

/**
 * Clamps a dimension value to the maximum allowed
 * @param value - The dimension value to clamp
 * @returns Clamped value or null if not provided
 */
function clampDimension(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.min(Math.max(1, value), MAX_DIMENSION);
}

/**
 * Image embed extension configured for blog posts
 *
 * Supports image embeds with:
 * - URL sanitization (rejects javascript: and data: URLs)
 * - Dimension clamping (max 2000x2000px)
 * - Alt text for accessibility
 * - Integration with MDX serialization
 *
 * @example
 * ```typescript
 * import { ImageEmbedExtension } from './extensions/image-figure';
 * import { Editor } from '@tiptap/core';
 *
 * const editor = new Editor({
 *   extensions: [ImageEmbedExtension]
 * });
 *
 * // Add image with all attributes
 * editor.commands.setImage({
 *   src: 'https://example.com/image.jpg',
 *   alt: 'Description',
 *   width: 800,
 *   height: 600
 * });
 *
 * // Add image with just src
 * editor.commands.setImage({
 *   src: 'https://example.com/photo.jpg'
 * });
 * ```
 */
export const ImageEmbedExtension = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => sanitizeImageURL(element.getAttribute('src')),
        renderHTML: attributes => {
          const sanitized = sanitizeImageURL(attributes.src);
          if (!sanitized) {
            return {};
          }
          return { src: sanitized };
        }
      },
      alt: {
        default: null,
        parseHTML: element => element.getAttribute('alt'),
        renderHTML: attributes => {
          if (attributes.alt === null || attributes.alt === undefined) {
            return {};
          }
          return { alt: attributes.alt };
        }
      },
      width: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('width');
          return width ? clampDimension(parseInt(width, 10)) : null;
        },
        renderHTML: attributes => {
          const clamped = clampDimension(attributes.width);
          if (clamped === null) {
            return {};
          }
          return { width: clamped };
        }
      },
      height: {
        default: null,
        parseHTML: element => {
          const height = element.getAttribute('height');
          return height ? clampDimension(parseInt(height, 10)) : null;
        },
        renderHTML: attributes => {
          const clamped = clampDimension(attributes.height);
          if (clamped === null) {
            return {};
          }
          return { height: clamped };
        }
      }
    };
  },

  addCommands() {
    return {
      setImage:
        options =>
        ({ commands }) => {
          // Sanitize URL before setting
          const sanitizedSrc = sanitizeImageURL(options.src);
          if (!sanitizedSrc) {
            console.warn('Cannot set image with invalid src');
            return false;
          }

          // Handle alt text: preserve explicit empty string, use null for undefined
          const altText = options.alt !== undefined ? options.alt : null;

          return commands.insertContent({
            type: this.name,
            attrs: {
              src: sanitizedSrc,
              alt: altText,
              width: clampDimension(options.width),
              height: clampDimension(options.height)
            }
          });
        }
    };
  }
});

/**
 * Re-export Image types for type safety
 */
export type { ImageOptions } from '@tiptap/extension-image';

/**
 * Type for image embed attributes
 */
export interface ImageEmbedAttributes {
  src: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}
