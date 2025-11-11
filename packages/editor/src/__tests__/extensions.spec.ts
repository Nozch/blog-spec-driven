import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  DEFAULT_APPEARANCE,
  FONT_SIZE_RANGE,
  LEFT_PADDING_RANGE,
  IMAGE_WIDTH_RANGE,
  createExtensionKit,
  getAppearanceSettings
} from '../extensions';

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

    const node = editor.getJSON().content?.at(-1);
    expect(node?.type).toBe('imageFigure');
    expect(node?.attrs?.caption).toBe('Figure 1');
    expect(node?.attrs?.width).toBe(IMAGE_WIDTH_RANGE.max);

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

    const videoNode = editor.getJSON().content?.at(-1);
    expect(videoNode?.type).toBe('videoEmbed');
    expect(videoNode?.attrs?.provider).toBe('youtube');

    const rejected = editor.commands.insertVideoEmbed({
      src: 'https://files.example.com/video.mp4'
    });
    expect(rejected).toBe(false);
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
    editor.commands.setAppearance({ leftPadding: 48 });
    expect(getAppearanceSettings(editor)).toMatchObject({
      fontSize: DEFAULT_APPEARANCE.fontSize,
      leftPadding: 48
    });

    editor.commands.resetAppearance();
    expect(getAppearanceSettings(editor)).toEqual(DEFAULT_APPEARANCE);
  });
});
