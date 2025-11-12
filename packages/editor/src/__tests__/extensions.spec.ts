import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_ASPECT_RATIO,
  FONT_SIZE_RANGE,
  LEFT_PADDING_RANGE,
  IMAGE_WIDTH_RANGE,
  createExtensionKit,
  getAppearanceSettings
} from '../extensions';

// Verifies command and extension behavior on existing TipTap documents.

const buildEditor = (content = '<p>hello blog</p>') =>
  new Editor({
    content,
    extensions: [
      StarterKit.configure({
        heading: false,
        image: false
      }),
      ...createExtensionKit()
    ]
  });

describe('heading extension configuration', () => {
  it('only allows heading levels 1–4', () => {
    const editor = buildEditor();
    expect(editor.commands.toggleHeading({ level: 2 })).toBe(true);
    expect(editor.getJSON().content?.[0]?.type).toBe('heading');

    const rejected = editor.commands.toggleHeading({ level: 5 });
    expect(rejected).toBe(false);
    expect(editor.getJSON().content?.[0]?.attrs?.level).toBe(2);
  });
});

describe('media embeds', () => {
  it('stores caption/width metadata for image figures', () => {
    const editor = buildEditor();
    const ok = editor.commands.insertImageFigure({
      src: 'https://cdn.example.com/img.png',
      caption: 'Figure 1',
      width: IMAGE_WIDTH_RANGE.max + 100
    });
    expect(ok).toBe(true);

    const doc = editor.getJSON();
    const node = doc.content?.find((block) => block.type === 'imageFigure');
    expect(node).toBeDefined();
    expect(node?.type).toBe('imageFigure');
    expect(node?.attrs?.caption).toBe('Figure 1');
    expect(node?.attrs?.width).toBe(IMAGE_WIDTH_RANGE.max);
    // Inserting a figure does not disturb the trailing paragraph.
    expect(doc.content?.at(-1)?.type).toBe('paragraph');

    const invalid = editor.commands.insertImageFigure({
      src: 'ftp://malware/img.png'
    });
    expect(invalid).toBe(false);
  });

  it('accepts supported video providers and rejects others', () => {
    const editor = buildEditor();
    const accepted = editor.commands.insertVideoEmbed({
      src: 'https://www.youtube.com/watch?v=12345',
      title: 'Demo'
    });
    expect(accepted).toBe(true);

    const doc = editor.getJSON();
    const videoNode = doc.content?.find((block) => block.type === 'videoEmbed');
    expect(videoNode).toBeDefined();
    expect(videoNode?.type).toBe('videoEmbed');
    expect(videoNode?.attrs?.provider).toBe('youtube');
    // Video embeds insert before the trailing paragraph seed.
    expect(doc.content?.at(-1)?.type).toBe('paragraph');

    const rejected = editor.commands.insertVideoEmbed({
      src: 'https://files.example.com/video.mp4'
    });
    expect(rejected).toBe(false);
  });

  it('preserves order when embeds and paragraphs alternate', () => {
    const editor = buildEditor();
    const paragraph = (text: string) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }]
    });

    editor.commands.setContent({
      type: 'doc',
      content: [
        paragraph('alpha'),
        {
          type: 'imageFigure',
          attrs: {
            src: 'https://cdn.example.com/one.png',
            alt: '',
            caption: 'img',
            width: IMAGE_WIDTH_RANGE.min
          }
        },
        paragraph('bravo'),
        {
          type: 'videoEmbed',
          attrs: {
            src: 'https://www.youtube.com/watch?v=67890',
            title: 'vid',
            provider: 'youtube',
            aspectRatio: DEFAULT_ASPECT_RATIO
          }
        },
        paragraph('charlie')
      ]
    });

    const types = (editor.getJSON().content ?? []).map((node) => node.type);
    // TipTap should preserve explicit node ordering when content is injected programmatically.
    expect(types).toEqual(['paragraph', 'imageFigure', 'paragraph', 'videoEmbed', 'paragraph']);
  });
});

describe('video embeds', () => {
  const insertVideo = (src: string) => {
    const editor = buildEditor();
    const ok = editor.commands.insertVideoEmbed({
      src,
      title: 'Demo clip'
    });
    expect(ok).toBe(true);
    const doc = editor.getJSON();
    return doc.content?.find((block) => block.type === 'videoEmbed');
  };

  const renderVideoIframe = (attrs: { src: string; provider: 'youtube' | 'vimeo' }) => {
    const videoExtension = createExtensionKit().find((extension) => extension.name === 'videoEmbed');
    expect(videoExtension?.config.renderHTML).toBeDefined();
    const htmlSpec = videoExtension!.config.renderHTML!({
      node: {} as never,
      HTMLAttributes: {
        src: attrs.src,
        title: 'Render test',
        provider: attrs.provider,
        aspectRatio: DEFAULT_ASPECT_RATIO
      }
    });

    expect(Array.isArray(htmlSpec)).toBe(true);
    const iframeSpec = Array.isArray(htmlSpec) ? htmlSpec[2] : null;
    expect(Array.isArray(iframeSpec)).toBe(true);
    const iframeAttrs = Array.isArray(iframeSpec) ? iframeSpec[1] : null;
    expect(iframeAttrs).toBeDefined();
    return iframeAttrs as Record<string, string>;
  };

  it('normalizeVideoAttrs converts YouTube watch URLs to embed form', () => {
    const videoNode = insertVideo('https://www.youtube.com/watch?v=abc123');
    expect(videoNode?.attrs?.src).toBe('https://www.youtube.com/embed/abc123');
  });

  it('normalizeVideoAttrs converts youtu.be short URLs to embed form', () => {
    const videoNode = insertVideo('https://youtu.be/abc123');
    expect(videoNode?.attrs?.src).toBe('https://www.youtube.com/embed/abc123');
  });

  it('normalizeVideoAttrs converts Vimeo page URLs to embed form', () => {
    const videoNode = insertVideo('https://vimeo.com/123456');
    expect(videoNode?.attrs?.src).toBe('https://player.vimeo.com/video/123456');
  });

  it('renderHTML emits iframe with embeddable YouTube src', () => {
    const iframeAttrs = renderVideoIframe({
      src: 'https://www.youtube.com/watch?v=abc123',
      provider: 'youtube'
    });
    expect(iframeAttrs.src).toBe('https://www.youtube.com/embed/abc123');
    expect(iframeAttrs.src).not.toContain('watch?v=');
  });

  it('renderHTML emits iframe with embeddable Vimeo src', () => {
    const iframeAttrs = renderVideoIframe({
      src: 'https://vimeo.com/123456',
      provider: 'vimeo'
    });
    expect(iframeAttrs.src).toBe('https://player.vimeo.com/video/123456');
    expect(iframeAttrs.src).toContain('player.vimeo.com');
  });
});

describe('appearance controls', () => {
  it('exposes defaults on storage', () => {
    const editor = buildEditor();
    expect(getAppearanceSettings(editor)).toEqual(DEFAULT_APPEARANCE);
  });

  it('clamps font size and padding inside allowed ranges', () => {
    const editor = buildEditor();

    editor.commands.setFontSize(FONT_SIZE_RANGE.max + 20);
    editor.commands.setLeftPadding(LEFT_PADDING_RANGE.min - 16);

    expect(getAppearanceSettings(editor)).toMatchObject({
      fontSize: FONT_SIZE_RANGE.max,
      leftPadding: LEFT_PADDING_RANGE.min
    });
  });

  it('merges partial appearance updates and supports reset', () => {
    const editor = buildEditor();
    const initial = getAppearanceSettings(editor);
    editor.commands.setAppearance({ leftPadding: 48 });
    expect(getAppearanceSettings(editor)).toMatchObject({
      // Partial updates retain existing values for unspecified fields.
      fontSize: initial.fontSize,
      leftPadding: 48
    });

    editor.commands.resetAppearance();
    expect(getAppearanceSettings(editor)).toEqual(DEFAULT_APPEARANCE);
  });
});
