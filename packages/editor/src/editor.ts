import { Editor, type EditorOptions, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  DEFAULT_APPEARANCE,
  type AppearanceSettings,
  createExtensionKit,
  getAppearanceSettings,
  IMAGE_WIDTH_RANGE,
  type ImageEmbedAttributes,
  type VideoEmbedAttributes
} from './extensions';

export interface CreateEditorOptions {
  /**
   * Optional DOM element to mount the editor on (used by @tiptap/react under the hood).
   */
  element?: HTMLElement;
  /**
   * Initial TipTap JSON document. Takes precedence over mdx if both are provided.
   */
  tiptap?: JSONContent;
  /**
   * MDX string to hydrate into TipTap JSON when no tiptap content is passed.
   */
  mdx?: string;
  /**
   * Optional appearance overrides to seed the appearance extension store.
   */
  appearance?: AppearanceSettings;
  /**
   * Additional TipTap editor options (onUpdate handlers, autofocus, etc.).
   */
  editorOptions?: Partial<EditorOptions>;
}

export interface EditorSerializedState {
  tiptap: JSONContent;
  mdx: string;
  appearance: AppearanceSettings;
}

export const createEditor = (options: CreateEditorOptions = {}): Editor => {
  const initialContent = options.tiptap ?? (options.mdx ? mdxToJSON(options.mdx) : undefined);

  return new Editor({
    element: options.element,
    extensions: [
      StarterKit.configure({
        heading: false,
        image: false
      }),
      ...createExtensionKit()
    ],
    content: initialContent,
    onCreate: ({ editor }) => {
      if (options.appearance) {
        editor.commands.setAppearance(options.appearance);
      }
    },
    ...(options.editorOptions ?? {})
  });
};

export const serializeEditorState = (editor: Editor): EditorSerializedState => {
  const json = editor.getJSON();
  return {
    tiptap: json,
    mdx: jsonToMDX(json),
    appearance: getAppearanceSettings(editor)
  };
};

export const mdxToJSON = (mdx: string): JSONContent => ({
  type: 'doc',
  content: parseBlocks(normalizeLines(mdx))
});

export const jsonToMDX = (json: JSONContent): string => serializeBlocks(json.content ?? []);

const normalizeLines = (input: string): string[] =>
  input
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());

type Block = JSONContent;

const parseBlocks = (lines: string[]): Block[] => {
  const blocks: Block[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: { ordered: boolean; items: string[][] } | null = null;
  let codeBuffer: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';

  const flushParagraph = () => {
    if (!paragraphBuffer.length) {
      return;
    }
    const text = paragraphBuffer.join(' ').trim();
    if (text) {
      blocks.push(createParagraph(text));
    }
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer) {
      return;
    }
    blocks.push({
      type: listBuffer.ordered ? 'orderedList' : 'bulletList',
      content: listBuffer.items.map((itemLines) => ({
        type: 'listItem',
        content: [createParagraph(itemLines.join(' ').trim())]
      }))
    });
    listBuffer = null;
  };

  const flushCode = () => {
    if (!codeBuffer.length) {
      return;
    }
    blocks.push({
      type: 'codeBlock',
      attrs: {
        language: codeLanguage || null
      },
      content: [
        {
          type: 'text',
          text: codeBuffer.join('\n')
        }
      ]
    });
    codeBuffer = [];
    codeLanguage = '';
  };

  const pushBlock = (block: Block) => {
    flushParagraph();
    flushList();
    blocks.push(block);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushParagraph();
        flushList();
        inCodeBlock = false;
        flushCode();
        continue;
      }
      flushParagraph();
      flushList();
      inCodeBlock = true;
      codeLanguage = line.slice(3).trim();
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const imageFigure = parseComponent(line, 'ImageFigure');
    if (imageFigure) {
      pushBlock({
        type: 'imageFigure',
        attrs: imageFigure
      });
      continue;
    }

    const videoEmbed = parseComponent(line, 'VideoEmbed');
    if (videoEmbed) {
      pushBlock({
        type: 'videoEmbed',
        attrs: videoEmbed
      });
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const [, hashes, text] = headingMatch;
      pushBlock({
        type: 'heading',
        attrs: { level: hashes.length },
        content: parseInline(text)
      });
      continue;
    }

    const bulletMatch = /^-\s+(.*)$/.exec(line);
    if (bulletMatch) {
      if (!listBuffer) {
        flushParagraph();
        listBuffer = { ordered: false, items: [] };
      } else if (listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push([bulletMatch[1]]);
      continue;
    }

    const orderedMatch = /^(\d+)\.\s+(.*)$/.exec(line);
    if (orderedMatch) {
      if (!listBuffer) {
        flushParagraph();
        listBuffer = { ordered: true, items: [] };
      } else if (!listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push([orderedMatch[2]]);
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  flushCode();

  return blocks;
};

const serializeBlocks = (blocks: Block[]): string =>
  blocks
    .map((node) => serializeBlock(node))
    .filter(Boolean)
    .join('\n\n')
    .trim();

type VideoComponentAttributes = VideoEmbedAttributes & { provider?: string };

const serializeBlock = (node: Block): string => {
  switch (node.type) {
    case 'paragraph':
      return serializeInline(node.content ?? []);
    case 'heading':
      return `${'#'.repeat(node.attrs?.level ?? 1)} ${serializeInline(node.content ?? [])}`;
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => `- ${serializeInline(item.content?.[0]?.content ?? [])}`)
        .join('\n');
    case 'orderedList': {
      return (node.content ?? [])
        .map((item, index) => `${index + 1}. ${serializeInline(item.content?.[0]?.content ?? [])}`)
        .join('\n');
    }
    case 'codeBlock': {
      const language = node.attrs?.language ?? '';
      const body = node.content?.[0]?.text ?? '';
      return ['```' + language, body, '```'].join('\n');
    }
    case 'imageFigure': {
      const attrs = node.attrs as ImageEmbedAttributes;
      return `<ImageFigure src="${attrs.src}" alt="${attrs.alt ?? ''}" caption="${attrs.caption ?? ''}" width={${attrs.width ?? IMAGE_WIDTH_RANGE.min}} />`;
    }
    case 'videoEmbed': {
      const attrs = node.attrs as VideoComponentAttributes;
      return `<VideoEmbed src="${attrs.src}" title="${attrs.title ?? ''}" provider="${attrs.provider ?? 'youtube'}" aspectRatio={${attrs.aspectRatio ?? 0.5625}} />`;
    }
    default:
      return '';
  }
};

const inlinePattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

const parseInline = (value: string): JSONContent[] => {
  const nodes: JSONContent[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(inlinePattern)) {
    const [token] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(createTextNode(value.slice(lastIndex, index)));
    }
    nodes.push(createMarkedNode(token));
    lastIndex = index + token.length;
  }
  if (lastIndex < value.length) {
    nodes.push(createTextNode(value.slice(lastIndex)));
  }
  return nodes;
};

const serializeInline = (nodes: JSONContent[]): string =>
  nodes
    .map((node) => {
      if (node.type === 'text') {
        return wrapMarks(node.text ?? '', node.marks ?? []);
      }
      if (node.type === 'hardBreak') {
        return '  \n';
      }
      return '';
    })
    .join('');

const wrapMarks = (
  text: string,
  marks: { type: string }[]
): string =>
  marks.reduce((acc, mark) => {
    switch (mark.type) {
      case 'bold':
        return `**${acc}**`;
      case 'italic':
        return `*${acc}*`;
      case 'code':
        return `\`${acc}\``;
      default:
        return acc;
    }
  }, text);

const createParagraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: parseInline(text)
});

const createTextNode = (text: string): JSONContent => ({
  type: 'text',
  text
});

const createMarkedNode = (token: string): JSONContent => {
  if (token.startsWith('**')) {
    return {
      type: 'text',
      text: token.slice(2, -2),
      marks: [{ type: 'bold' }]
    };
  }
  if (token.startsWith('*')) {
    return {
      type: 'text',
      text: token.slice(1, -1),
      marks: [{ type: 'italic' }]
    };
  }
  return {
    type: 'text',
    text: token.slice(1, -1),
    marks: [{ type: 'code' }]
  };
};

function parseComponent(line: string, component: 'ImageFigure'): ImageEmbedAttributes | null;
function parseComponent(line: string, component: 'VideoEmbed'): (VideoComponentAttributes & { provider: string }) | null;
function parseComponent(line: string, component: 'ImageFigure' | 'VideoEmbed') {
  if (!line.startsWith(`<${component}`) || !line.endsWith('/>')) {
    return null;
  }

  const attrPattern = /(\w+)=(?:"([^"]*)"|{([^}]+)})/g;
  const attrs: Record<string, string> = {};
  for (const match of line.matchAll(attrPattern)) {
    const [, key, quoted, braced] = match;
    attrs[key] = quoted ?? braced ?? '';
  }

  if (component === 'ImageFigure') {
    if (!attrs.src) {
      return null;
    }
    const width = Number(attrs.width ?? IMAGE_WIDTH_RANGE.min);
    const parsed: ImageEmbedAttributes = {
      src: attrs.src,
      alt: attrs.alt ?? '',
      caption: attrs.caption ?? '',
      width: Number.isFinite(width) ? width : IMAGE_WIDTH_RANGE.min
    };
    return parsed;
  }

  if (!attrs.src || !attrs.provider) {
    return null;
  }
  const aspectRatio = Number(attrs.aspectRatio ?? 0.5625);
  const result: VideoComponentAttributes & { provider: string } = {
    src: attrs.src,
    title: attrs.title ?? '',
    provider: attrs.provider,
    aspectRatio: Number.isFinite(aspectRatio) ? aspectRatio : 0.5625
  };
  return result;
}

export const buildEmptyState = (): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '' }]
    }
  ]
});

export const mergeAppearance = (incoming?: AppearanceSettings): AppearanceSettings => ({
  fontSize: incoming?.fontSize ?? DEFAULT_APPEARANCE.fontSize,
  leftPadding: incoming?.leftPadding ?? DEFAULT_APPEARANCE.leftPadding
});
