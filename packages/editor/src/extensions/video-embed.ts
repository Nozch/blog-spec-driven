/**
 * Video Embed Extension (T034)
 *
 * Provides video embed support for the blog editor with provider allowlist.
 *
 * Requirements:
 * - FR-001: System MUST allow composing articles in-browser with video embeds
 * - Provider allowlist: Only YouTube, Vimeo, Dailymotion allowed
 * - URL validation and normalization to embed format
 * - Dimension clamping (max 1920x1080px)
 * - XSS protection via protocol and domain validation
 *
 * Technical decisions (from research.md):
 * - Custom TipTap node (no built-in video extension)
 * - Configured to validate and normalize video URLs
 * - Automatic conversion to embeddable iframe sources
 */

import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Maximum dimensions for video embeds
 * Standard 1080p resolution
 */
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

/**
 * Default aspect ratio for videos (16:9)
 */
const DEFAULT_ASPECT_RATIO = '16:9';

/**
 * Supported video providers with domain patterns
 */
const ALLOWED_PROVIDERS = {
  youtube: {
    patterns: [
      /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
      /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
      /^(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/
    ],
    embedTemplate: (videoId: string) => `https://www.youtube.com/embed/${videoId}`
  },
  vimeo: {
    patterns: [
      /^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/,
      /^(?:https?:\/\/)?player\.vimeo\.com\/video\/(\d+)/
    ],
    embedTemplate: (videoId: string) => `https://player.vimeo.com/video/${videoId}`
  },
  dailymotion: {
    patterns: [
      /^(?:https?:\/\/)?(?:www\.)?dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
      /^(?:https?:\/\/)?(?:www\.)?dai\.ly\/([a-zA-Z0-9]+)/
    ],
    embedTemplate: (videoId: string) => `https://www.dailymotion.com/embed/video/${videoId}`
  }
};

/**
 * Validates and normalizes a video URL
 * @param url - The URL to validate
 * @returns Object with normalized src and provider, or null if invalid
 */
function validateAndNormalizeVideoURL(url: string | null | undefined): {
  src: string;
  provider: string;
} | null {
  if (!url) return null;

  // Reject dangerous protocols
  if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('file:')) {
    console.warn(`Rejected video URL with dangerous protocol: ${url}`);
    return null;
  }

  // Try to match against allowed providers
  for (const [providerName, config] of Object.entries(ALLOWED_PROVIDERS)) {
    for (const pattern of config.patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const videoId = match[1];
        return {
          src: config.embedTemplate(videoId),
          provider: providerName
        };
      }
    }
  }

  console.warn(`Video URL not from allowed provider: ${url}`);
  return null;
}

/**
 * Clamps a dimension value to the maximum allowed
 * @param value - The dimension value to clamp
 * @param max - Maximum value
 * @returns Clamped value or null if not provided
 */
function clampDimension(value: number | null | undefined, max: number): number | null {
  if (value === null || value === undefined) return null;
  return Math.min(Math.max(1, value), max);
}

/**
 * Validates aspect ratio format
 * @param ratio - Aspect ratio string (e.g., "16:9")
 * @returns Valid aspect ratio or default
 */
function validateAspectRatio(ratio: string | null | undefined): string {
  if (!ratio) return DEFAULT_ASPECT_RATIO;

  // Accept common aspect ratios
  const validRatios = ['16:9', '4:3', '21:9', '1:1'];
  if (validRatios.includes(ratio)) {
    return ratio;
  }

  return DEFAULT_ASPECT_RATIO;
}

/**
 * Video embed extension configured for blog posts
 *
 * Supports video embeds with:
 * - Provider allowlist (YouTube, Vimeo, Dailymotion)
 * - URL normalization to embed format
 * - Dimension clamping (max 1920x1080px)
 * - Aspect ratio support (16:9, 4:3, etc.)
 * - XSS protection via protocol validation
 *
 * @example
 * ```typescript
 * import { VideoEmbedExtension } from './extensions/video-embed';
 * import { Editor } from '@tiptap/core';
 *
 * const editor = new Editor({
 *   extensions: [VideoEmbedExtension]
 * });
 *
 * // Add YouTube video
 * editor.commands.setVideo({
 *   src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
 *   width: 640,
 *   height: 360
 * });
 *
 * // Add Vimeo video with aspect ratio
 * editor.commands.setVideo({
 *   src: 'https://vimeo.com/123456789',
 *   aspectRatio: '16:9'
 * });
 * ```
 */
export const VideoEmbedExtension = Node.create({
  name: 'video',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => {
          const iframe = element.querySelector('iframe');
          return iframe?.getAttribute('src') || element.getAttribute('src');
        },
        renderHTML: attributes => {
          if (!attributes.src) return {};
          return { src: attributes.src };
        }
      },
      provider: {
        default: null,
        parseHTML: element => element.getAttribute('data-provider'),
        renderHTML: attributes => {
          if (!attributes.provider) return {};
          return { 'data-provider': attributes.provider };
        }
      },
      width: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('width');
          return width ? clampDimension(parseInt(width, 10), MAX_WIDTH) : null;
        },
        renderHTML: attributes => {
          const clamped = clampDimension(attributes.width, MAX_WIDTH);
          if (clamped === null) return {};
          return { width: clamped };
        }
      },
      height: {
        default: null,
        parseHTML: element => {
          const height = element.getAttribute('height');
          return height ? clampDimension(parseInt(height, 10), MAX_HEIGHT) : null;
        },
        renderHTML: attributes => {
          const clamped = clampDimension(attributes.height, MAX_HEIGHT);
          if (clamped === null) return {};
          return { height: clamped };
        }
      },
      aspectRatio: {
        default: DEFAULT_ASPECT_RATIO,
        parseHTML: element => element.getAttribute('data-aspect-ratio') || DEFAULT_ASPECT_RATIO,
        renderHTML: attributes => {
          const ratio = validateAspectRatio(attributes.aspectRatio);
          return { 'data-aspect-ratio': ratio };
        }
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video-embed]',
      },
      {
        tag: 'iframe[src*="youtube.com"]',
      },
      {
        tag: 'iframe[src*="vimeo.com"]',
      },
      {
        tag: 'iframe[src*="dailymotion.com"]',
      }
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { src, width, height } = node.attrs;

    // Create iframe element
    return [
      'div',
      mergeAttributes({ 'data-video-embed': '' }, HTMLAttributes),
      [
        'iframe',
        {
          src,
          width: width || 640,
          height: height || 360,
          frameborder: '0',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowfullscreen: 'true'
        }
      ]
    ];
  },

  addCommands() {
    return {
      setVideo:
        (options: {
          src: string;
          width?: number;
          height?: number;
          aspectRatio?: string;
        }) =>
        ({ commands }) => {
          // Validate and normalize URL
          const validated = validateAndNormalizeVideoURL(options.src);
          if (!validated) {
            console.warn('Cannot set video with invalid or unauthorized src');
            return false;
          }

          return commands.insertContent({
            type: this.name,
            attrs: {
              src: validated.src,
              provider: validated.provider,
              width: clampDimension(options.width, MAX_WIDTH),
              height: clampDimension(options.height, MAX_HEIGHT),
              aspectRatio: validateAspectRatio(options.aspectRatio)
            }
          });
        }
    };
  }
});

/**
 * Type for video embed attributes
 */
export interface VideoEmbedAttributes {
  src: string;
  provider?: 'youtube' | 'vimeo' | 'dailymotion';
  width?: number | null;
  height?: number | null;
  aspectRatio?: string;
}
