import { Extension, Node, mergeAttributes, type Editor } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import { TextStylesExtension } from './extensions/text-styles';

export type AppearanceSettings = {
  fontSize: number;
  leftPadding: number;
};

export const FONT_SIZE_RANGE = { min: 14, max: 24 } as const;
export const LEFT_PADDING_RANGE = { min: 0, max: 64 } as const;
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontSize: 16,
  leftPadding: 24
};

export const IMAGE_WIDTH_RANGE = { min: 240, max: 1200 } as const;
export const DEFAULT_IMAGE_WIDTH = 720;

export const DEFAULT_ASPECT_RATIO = 16 / 9; // 16:9 landscape ratio

export interface ImageEmbedAttributes {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
}

export interface VideoEmbedAttributes {
  src: string;
  title?: string;
  aspectRatio?: number;
}

type VideoProvider = 'youtube' | 'vimeo';

export const SUPPORTED_VIDEO_HOSTS: Record<string, VideoProvider> = {
  'youtube.com': 'youtube',
  'www.youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'm.youtube.com': 'youtube',
  'vimeo.com': 'vimeo',
  'www.vimeo.com': 'vimeo',
  'player.vimeo.com': 'vimeo'
};

const clamp = (value: number, range: { min: number; max: number }) =>
  Math.min(range.max, Math.max(range.min, value));

export const sanitizeUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

export const toEmbedUrl = (raw: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const buildYouTubeEmbed = (videoId?: string | null) =>
    videoId ? `https://www.youtube.com/embed/${videoId}` : null;

  if (hostname === 'youtu.be') {
    return buildYouTubeEmbed(pathSegments[0]);
  }

  if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'm.youtube.com') {
    if (pathSegments[0] === 'embed' && pathSegments[1]) {
      return buildYouTubeEmbed(pathSegments[1]);
    }
    return buildYouTubeEmbed(parsed.searchParams.get('v'));
  }

  const buildVimeoEmbed = (videoId?: string | null) =>
    videoId ? `https://player.vimeo.com/video/${videoId}` : null;

  if (hostname === 'player.vimeo.com') {
    if (pathSegments[0] === 'video' && pathSegments[1]) {
      return buildVimeoEmbed(pathSegments[1]);
    }
    return buildVimeoEmbed(pathSegments[0]);
  }

  if (hostname === 'vimeo.com' || hostname === 'www.vimeo.com') {
    return buildVimeoEmbed(pathSegments[0]);
  }

  return null;
};

const normalizeImageAttrs = (
  attrs: ImageEmbedAttributes
): (ImageEmbedAttributes & { width: number }) | null => {
  const src = sanitizeUrl(attrs.src);
  if (!src) {
    return null;
  }

  const width = clamp(attrs.width ?? DEFAULT_IMAGE_WIDTH, IMAGE_WIDTH_RANGE);

  return {
    src,
    width,
    alt: attrs.alt?.trim() ?? '',
    caption: attrs.caption?.trim() ?? ''
  };
};

export const normalizeVideoAttrs = (
  attrs: VideoEmbedAttributes
): (VideoEmbedAttributes & { provider: VideoProvider; aspectRatio: number }) | null => {
  const src = sanitizeUrl(attrs.src);
  if (!src) {
    return null;
  }

  const embedUrl = toEmbedUrl(src);
  if (!embedUrl) {
    return null;
  }

  let provider: VideoProvider | undefined;
  try {
    const { hostname } = new URL(embedUrl);
    provider = SUPPORTED_VIDEO_HOSTS[hostname];
  } catch {
    provider = undefined;
  }

  if (!provider) {
    return null;
  }

  const aspectRatio = attrs.aspectRatio && attrs.aspectRatio > 0 ? attrs.aspectRatio : DEFAULT_ASPECT_RATIO;

  return {
    src: embedUrl,
    title: attrs.title?.trim() ?? '',
    aspectRatio,
    provider
  };
};

const ImageFigure = Image.extend({
  name: 'imageFigure',
  inline() {
    return false;
  },
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: ''
      },
      width: {
        default: DEFAULT_IMAGE_WIDTH
      }
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { caption, ...imgAttrs } = HTMLAttributes;
    const figureAttrs = {
      'data-image-figure': 'true',
      style: `max-width:${imgAttrs.width || DEFAULT_IMAGE_WIDTH}px`
    };

    if (caption) {
      return [
        'figure',
        figureAttrs,
        ['img', mergeAttributes(imgAttrs)],
        ['figcaption', {}, caption]
      ];
    }

    return ['figure', figureAttrs, ['img', mergeAttributes(imgAttrs)]];
  },
  addCommands() {
    return {
      insertImageFigure:
        (attrs: ImageEmbedAttributes) =>
        ({ chain }) => {
          const normalized = normalizeImageAttrs(attrs);
          if (!normalized) {
            return false;
          }

          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: normalized
            })
            .run();
        }
    };
  }
});

const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  defining: true,
  addAttributes() {
    return {
      src: {
        default: null
      },
      title: {
        default: ''
      },
      provider: {
        default: 'youtube'
      },
      aspectRatio: {
        default: DEFAULT_ASPECT_RATIO
      }
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-video-embed]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const rawSrc = typeof HTMLAttributes.src === 'string' ? HTMLAttributes.src : null;
    const normalizedSrc = rawSrc ? toEmbedUrl(rawSrc) ?? rawSrc : null;
    if (!normalizedSrc) {
      return ['figure', { 'data-video-embed': 'true' }];
    }

    return [
      'figure',
      { 'data-video-embed': 'true' },
      [
        'iframe',
        {
          src: normalizedSrc,
          title: HTMLAttributes.title,
          allowfullscreen: 'true',
          'data-provider': HTMLAttributes.provider,
          style: `aspect-ratio:${(HTMLAttributes.aspectRatio as number) || DEFAULT_ASPECT_RATIO}`
        }
      ]
    ];
  },
  addCommands() {
    return {
      insertVideoEmbed:
        (attrs: VideoEmbedAttributes) =>
        ({ chain }) => {
          const normalized = normalizeVideoAttrs(attrs);
          if (!normalized) {
            return false;
          }

          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: normalized
            })
            .run();
        }
    };
  }
});

type AppearanceStorage = {
  appearance: AppearanceSettings;
};

const AppearanceExtension = Extension.create({
  name: 'appearanceControls',
  addStorage() {
    return {
      appearance: { ...DEFAULT_APPEARANCE }
    } satisfies AppearanceStorage;
  },
  addCommands() {
    const extension = this;
    const applyUpdate = (update: Partial<AppearanceSettings>) => {
      const storage = extension.storage as AppearanceStorage;
      const next: AppearanceSettings = {
        fontSize: clamp(update.fontSize ?? storage.appearance.fontSize, FONT_SIZE_RANGE),
        leftPadding: clamp(update.leftPadding ?? storage.appearance.leftPadding, LEFT_PADDING_RANGE)
      };
      storage.appearance = next;
      return true;
    };

    return {
      setFontSize:
        (value: number) =>
        () =>
          applyUpdate({ fontSize: value }),
      setLeftPadding:
        (value: number) =>
        () =>
          applyUpdate({ leftPadding: value }),
      setAppearance:
        (settings: Partial<AppearanceSettings>) =>
        () =>
          applyUpdate(settings),
      resetAppearance:
        () =>
        () => {
          const storage = extension.storage as AppearanceStorage;
          storage.appearance = { ...DEFAULT_APPEARANCE };
          return true;
        }
    };
  }
});

export const createExtensionKit = (): Extension[] => [
  Heading.configure({ levels: [1, 2, 3, 4] }),
  TextStylesExtension,
  ImageFigure,
  VideoEmbed,
  AppearanceExtension
];

export const getAppearanceSettings = (editor: Pick<Editor, 'storage'>): AppearanceSettings => {
  const storage = editor.storage?.appearanceControls as AppearanceStorage | undefined;
  return storage ? { ...storage.appearance } : { ...DEFAULT_APPEARANCE };
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mediaEmbeds: {
      insertImageFigure: (attrs: ImageEmbedAttributes) => ReturnType;
      insertVideoEmbed: (attrs: VideoEmbedAttributes) => ReturnType;
    };
    appearanceControls: {
      setFontSize: (value: number) => ReturnType;
      setLeftPadding: (value: number) => ReturnType;
      setAppearance: (settings: Partial<AppearanceSettings>) => ReturnType;
      resetAppearance: () => ReturnType;
    };
  }

  interface Storage {
    appearanceControls: AppearanceStorage;
  }
}
