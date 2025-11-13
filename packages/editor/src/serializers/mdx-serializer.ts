import { type JSONContent } from '@tiptap/core';
import { DEFAULT_ASPECT_RATIO, type ImageEmbedAttributes, type VideoEmbedAttributes } from '../extensions';

/**
 * TipTap to MDX Serializer (T037)
 *
 * Converts TipTap JSON document structure to MDX (Markdown + JSX) format.
 * This module handles content serialization only; appearance settings are stored separately.
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

/**
 * Main entry point for serializing TipTap JSON to MDX string.
 *
 * @param json - TipTap document JSON structure
 * @returns MDX string representation
 */
export const serializeTipTapToMDX = (json: JSONContent): string => {
  return serializeBlocks(json.content ?? []);
};

/**
 * Serialize an array of blocks into MDX, joining with blank lines.
 */
const serializeBlocks = (blocks: Block[]): string =>
  blocks
    .map((node) => serializeBlock(node))
    .filter(Boolean)
    .join('\n\n')
    .trim();

/**
 * Serialize a single block node to MDX.
 */
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
      const attrs = node.attrs as (VideoEmbedAttributes & { provider?: string });
      return `<VideoEmbed src=${jsxString(attrs.src)} title=${jsxString(attrs.title)} provider=${jsxString(
        attrs.provider ?? 'youtube'
      )} aspectRatio={${attrs.aspectRatio ?? DEFAULT_ASPECT_RATIO}} />`;
    }

    default:
      // Skip unknown node types gracefully
      return '';
  }
};

/**
 * Serialize a list (bullet or ordered) to MDX.
 */
const serializeList = (node: Block, depth = 0): string => {
  const items = node.content ?? [];
  const isOrdered = node.type === 'orderedList';
  return items
    .map((item, index) => serializeListItem(item, depth, isOrdered ? `${index + 1}. ` : '- '))
    .filter(Boolean)
    .join('\n');
};

/**
 * Serialize a single list item with proper indentation.
 */
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

/**
 * Serialize inline content (text with marks) to MDX.
 */
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

/**
 * Wrap text with markdown formatting based on marks.
 */
const wrapMarks = (text: string, marks: { type: string }[]): string =>
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

/**
 * Convert a string value to JSX attribute format using JSON.stringify.
 * This ensures proper escaping of special characters.
 */
const jsxString = (value: string | null | undefined) => `{${JSON.stringify(value ?? '')}}`;
