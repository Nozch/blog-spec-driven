import { Editor, type EditorOptions, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_ASPECT_RATIO,
  type AppearanceSettings,
  createExtensionKit,
  getAppearanceSettings,
  IMAGE_WIDTH_RANGE,
  type ImageEmbedAttributes,
  type VideoEmbedAttributes,
  normalizeVideoAttrs,
  sanitizeUrl
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
  const editorOptions = options.editorOptions ?? {};
  const userOnCreate = editorOptions.onCreate;
  let hasSeededAppearance = false;

  const runAppearanceSeeding = (ctx: { editor: Editor }) => {
    if (hasSeededAppearance) {
      return;
    }
    hasSeededAppearance = true;
    if (options.appearance) {
      ctx.editor.commands.setAppearance(options.appearance);
    }
    userOnCreate?.(ctx);
  };

  const editor = new Editor({
    element: options.element,
    extensions: [
      StarterKit.configure({
        heading: false,   // Using custom HeadingExtension (T030)
        image: false,     // Using custom ImageFigure (T033)
        codeBlock: false, // Using custom CodeBlockExtension (T032)
        bold: false,      // Using custom TextStylesExtension for bold (T031)
        italic: false     // Using custom TextStylesExtension for italic (T031)
      }),
      ...createExtensionKit()
    ],
    content: initialContent,
    ...editorOptions,
    onCreate: runAppearanceSeeding
  });

  runAppearanceSeeding({ editor });

  return editor;
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

const normalizeLines = (input: string): string[] => input.replace(/\r\n/g, '\n').split('\n');

const clampNumber = (value: number, range: { min: number; max: number }) =>
  Math.min(range.max, Math.max(range.min, value));

type Block = JSONContent;

type ListItemBuffer = {
  lines: string[];
  children: Block[];
};

type ListBuffer = {
  ordered: boolean;
  indent: number;
  items: ListItemBuffer[];
};

const parseBlocks = (lines: string[]): Block[] => {
  const blocks: Block[] = [];
  let paragraphBuffer: string[] = [];
  const listStack: ListBuffer[] = [];
  let codeBuffer: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';

  const createListBuffer = (ordered: boolean, indent: number): ListBuffer => ({
    ordered,
    indent,
    items: []
  });

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

  const buildListBlock = (buffer: ListBuffer): Block => ({
    type: buffer.ordered ? 'orderedList' : 'bulletList',
    content: buffer.items.map((item) => {
      const content: JSONContent[] = [];
      const text = item.lines.join(' ').trim();
      if (text) {
        content.push(createParagraph(text));
      }
      content.push(...item.children);
      return {
        type: 'listItem',
        content: content.length ? content : [createParagraph('')]
      };
    })
  });

  const appendListBlock = (block: Block) => {
    if (listStack.length) {
      const parent = listStack[listStack.length - 1];
      if (!parent.items.length) {
        parent.items.push({ lines: [], children: [] });
      }
      parent.items[parent.items.length - 1].children.push(block);
      return;
    }
    blocks.push(block);
  };

  const flushListStack = (targetIndent = -1) => {
    while (listStack.length && listStack[listStack.length - 1].indent > targetIndent) {
      const completed = listStack.pop()!;
      appendListBlock(buildListBlock(completed));
    }
  };

  const ensureListContext = (indent: number, ordered: boolean): ListBuffer => {
    while (listStack.length) {
      const top = listStack[listStack.length - 1];
      if (indent < top.indent || (indent === top.indent && top.ordered !== ordered)) {
        const completed = listStack.pop()!;
        appendListBlock(buildListBlock(completed));
        continue;
      }
      break;
    }

    let current = listStack[listStack.length - 1];
    if (!current || indent > current.indent) {
      if (current && !current.items.length) {
        current.items.push({ lines: [], children: [] });
      }
      const nestedBuffer = createListBuffer(ordered, indent);
      listStack.push(nestedBuffer);
      current = nestedBuffer;
    } else if (!current || current.indent !== indent) {
      const newBuffer = createListBuffer(ordered, indent);
      listStack.push(newBuffer);
      current = newBuffer;
    }

    if (current.ordered !== ordered) {
      const newBuffer = createListBuffer(ordered, indent);
      listStack.push(newBuffer);
      current = newBuffer;
    }

    return current;
  };

  const handleListLine = (ordered: boolean, text: string, indent: number) => {
    const buffer = ensureListContext(indent, ordered);
    buffer.items.push({ lines: [text], children: [] });
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
    flushListStack();
    blocks.push(block);
  };

  const flushAllLists = () => {
    flushListStack(-1);
  };

  for (const rawLine of lines) {
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushParagraph();
        flushAllLists();
        inCodeBlock = false;
        flushCode();
        continue;
      }
      flushParagraph();
      flushAllLists();
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
      flushAllLists();
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
      flushParagraph();
      handleListLine(false, bulletMatch[1], indent);
      continue;
    }

    const orderedMatch = /^(\d+)\.\s+(.*)$/.exec(line);
    if (orderedMatch) {
      flushParagraph();
      handleListLine(true, orderedMatch[2], indent);
      continue;
    }

    if (listStack.length) {
      flushAllLists();
    }
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushAllLists();
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
      return serializeList(node);
    case 'orderedList':
      return serializeList(node);
    case 'codeBlock': {
      const language = node.attrs?.language ?? '';
      const body = node.content?.[0]?.text ?? '';
      return ['```' + language, body, '```'].join('\n');
    }
    case 'imageFigure': {
      const attrs = node.attrs as ImageEmbedAttributes;
      const widthAttr = typeof attrs.width === 'number' ? ` width={${attrs.width}}` : '';
      return `<ImageFigure src=${jsxString(attrs.src)} alt=${jsxString(attrs.alt)} caption=${jsxString(
        attrs.caption
      )}${widthAttr} />`;
    }
    case 'videoEmbed': {
      const attrs = node.attrs as VideoComponentAttributes;
      return `<VideoEmbed src=${jsxString(attrs.src)} title=${jsxString(attrs.title)} provider=${jsxString(
        attrs.provider ?? 'youtube'
      )} aspectRatio={${attrs.aspectRatio ?? DEFAULT_ASPECT_RATIO}} />`;
    }
    default:
      return '';
  }
};

const serializeList = (node: Block, depth = 0): string => {
  const items = node.content ?? [];
  const isOrdered = node.type === 'orderedList';
  return items
    .map((item, index) => serializeListItem(item, depth, isOrdered ? `${index + 1}. ` : '- '))
    .filter(Boolean)
    .join('\n');
};

const serializeListItem = (item: JSONContent, depth: number, marker: string): string => {
  const indent = '  '.repeat(depth);
  const continuationIndent = `${indent}  `;
  const lines: string[] = [];
  let hasMarkerLine = false;

  const appendLines = (contentLines: string[], options?: { preserveIndent?: boolean }) => {
    if (!contentLines.length) {
      return;
    }
    const preserveIndent = options?.preserveIndent ?? false;

    if (!hasMarkerLine) {
      if (preserveIndent) {
        lines.push(`${indent}${marker}`.trimEnd());
        hasMarkerLine = true;
      } else {
        const [first, ...rest] = contentLines;
        lines.push(`${indent}${marker}${first}`);
        rest.forEach((line) => lines.push(`${continuationIndent}${line}`));
        hasMarkerLine = true;
        return;
      }
    }

    if (preserveIndent) {
      lines.push(...contentLines);
      return;
    }

    contentLines.forEach((line) => {
      lines.push(`${continuationIndent}${line}`);
    });
  };

  const ensureMarkerLine = () => {
    if (!hasMarkerLine) {
      lines.push(`${indent}${marker}`.trimEnd());
      hasMarkerLine = true;
    }
  };

  for (const child of item.content ?? []) {
    if (!child) {
      continue;
    }

    if (child.type === 'paragraph') {
      const text = serializeInline(child.content ?? []);
      if (!/\S/.test(text)) {
        continue;
      }
      appendLines(text.split('\n'));
      continue;
    }

    if (child.type === 'bulletList' || child.type === 'orderedList') {
      const nested = serializeList(child, depth + 1);
      if (nested) {
        ensureMarkerLine();
        appendLines(nested.split('\n'), { preserveIndent: true });
      }
      continue;
    }

    const serialized = serializeBlock(child);
    if (serialized && /\S/.test(serialized)) {
      appendLines(serialized.split('\n'));
    }
  }

  if (!hasMarkerLine) {
    lines.push(`${indent}${marker}`.trimEnd());
  }

  return lines.join('\n');
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

const jsxString = (value: string | null | undefined) => `{${JSON.stringify(value ?? '')}}`;

type ImageFigureAttrs = {
  src: string;
  width?: number;
  aspectRatio?: number;
  [key: string]: unknown;
};

function parseComponent(line: string, component: 'ImageFigure'): ImageEmbedAttributes | null;
function parseComponent(line: string, component: 'VideoEmbed'): (VideoComponentAttributes & { provider: string }) | null;
function parseComponent(line: string, component: 'ImageFigure' | 'VideoEmbed') {
  if (!line.startsWith(`<${component}`) || !line.endsWith('/>')) {
    return null;
  }

  const attrPattern = /(\w+)=(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|{([^}]+)})/g;
  const unescapeAttrValue = (value: string): string => value.replace(/\\(['"\\])/g, '$1');
  const attrs: ImageFigureAttrs = Object.create(null);
  for (const match of line.matchAll(attrPattern)) {
    const [, key, doubleQuoted, singleQuoted, braced] = match;
    if (braced) {
      try {
        attrs[key] = JSON.parse(braced);
      } catch {
        // ignore invalid JSON; leave undefined
      }
    } else {
      const raw = doubleQuoted ?? singleQuoted ?? '';
      attrs[key] = unescapeAttrValue(raw);
    }
  }

  if (component === 'ImageFigure') {
    if (typeof attrs.src !== 'string' || !attrs.src) {
      return null;
    }
    const sanitizedSrc = sanitizeUrl(attrs.src);
    if (!sanitizedSrc) {
      return null;
    }
    let width: number | undefined;
    if (typeof attrs.width === 'number') {
      width = clampNumber(attrs.width, IMAGE_WIDTH_RANGE);
    }
    const parsed: ImageEmbedAttributes = {
      src: sanitizedSrc,
      alt: attrs.alt ?? '',
      caption: attrs.caption ?? '',
      width
    };
    return parsed;
  }

  const normalized = normalizeVideoAttrs({
    src: typeof attrs.src === 'string' ? attrs.src : '',
    title: typeof attrs.title === 'string' ? attrs.title : '',
    aspectRatio: typeof attrs.aspectRatio === 'number' ? attrs.aspectRatio : undefined
  });

  if (!normalized) {
    return null;
  }

  return normalized;
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
