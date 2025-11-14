import { type JSONContent } from '@tiptap/core';
import {
  IMAGE_WIDTH_RANGE,
  type ImageEmbedAttributes,
  type VideoEmbedAttributes,
  normalizeVideoAttrs,
  sanitizeUrl
} from '../extensions';

/**
 * MDX to TipTap JSON Parser (T038)
 *
 * Converts MDX (Markdown + JSX) format to TipTap JSON document structure.
 * This module is the inverse of the MDX serializer (T037).
 *
 * Supported content types (from FR-001 and T030-T035):
 * - Headings (T030)
 * - Text styles: bold, italic, inline code (T031)
 * - Code blocks with syntax highlighting (T032)
 * - Image embeds with captions and sizing (T033)
 * - Video embeds with aspect ratios (T034)
 * - Bullet and ordered lists (nested support)
 * - Hard breaks
 */

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

type VideoComponentAttributes = Omit<VideoEmbedAttributes, 'provider'> & { provider?: string };

/**
 * Main entry point for parsing MDX string to TipTap JSON.
 *
 * @param mdx - MDX string representation
 * @returns TipTap document JSON structure
 */
export const parseMDXToTipTap = (mdx: string): JSONContent => ({
  type: 'doc',
  content: parseBlocks(normalizeLines(mdx))
});

/**
 * Normalize line endings and split into array of lines.
 */
const normalizeLines = (input: string): string[] => input.replace(/\r\n/g, '\n').split('\n');

/**
 * Clamp a number to a specific range.
 */
const clampNumber = (value: number, range: { min: number; max: number }) =>
  Math.min(range.max, Math.max(range.min, value));

/**
 * Parse array of lines into TipTap block nodes.
 */
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

/**
 * Pattern for matching inline formatting (bold, italic, code).
 */
const inlinePattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

/**
 * Parse inline content (text with marks) to TipTap JSON nodes.
 */
const parseInline = (value: string): JSONContent[] => {
  const nodes: JSONContent[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(inlinePattern)) {
    const [token] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const text = value.slice(lastIndex, index);
      if (text) {
        nodes.push(createTextNode(text));
      }
    }
    nodes.push(createMarkedNode(token));
    lastIndex = index + token.length;
  }
  if (lastIndex < value.length) {
    const text = value.slice(lastIndex);
    if (text) {
      nodes.push(createTextNode(text));
    }
  }
  return nodes.length ? nodes : [createTextNode('')];
};

/**
 * Create a paragraph node with parsed inline content.
 */
const createParagraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: parseInline(text)
});

/**
 * Create a plain text node.
 */
const createTextNode = (text: string): JSONContent => ({
  type: 'text',
  text
});

/**
 * Create a text node with marks (bold, italic, or code).
 */
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

type ImageFigureAttrs = {
  src: string;
  width?: number;
  aspectRatio?: number;
  [key: string]: unknown;
};

/**
 * Parse JSX-like component from a line.
 * Supports ImageFigure and VideoEmbed components with attributes.
 */
function parseComponent(line: string, component: 'ImageFigure'): ImageEmbedAttributes | null;
function parseComponent(
  line: string,
  component: 'VideoEmbed'
): (VideoComponentAttributes & { provider: string }) | null;
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
