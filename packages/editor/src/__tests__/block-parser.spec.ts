import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { mdxToJSON } from '../editor';

// Verifies Markdown -> TipTap conversion and block ordering.

const textFromParagraph = (node?: JSONContent) => node?.content?.[0]?.text ?? '';

const textFromFirstListItem = (node?: JSONContent) => node?.content?.[0]?.content?.[0]?.content?.[0]?.text ?? '';

const blockTypes = (nodes: JSONContent[] | undefined = []) => nodes.map((node) => node.type);

describe('block parser (Markdown -> TipTap conversion)', () => {
  it('emits list before a following paragraph without requiring a blank line', () => {
    const json = mdxToJSON('- item\nNext paragraph');
    const [list, paragraph] = json.content ?? [];

    expect(list?.type).toBe('bulletList');
    expect(textFromFirstListItem(list)).toBe('item');
    expect(paragraph?.type).toBe('paragraph');
    expect(textFromParagraph(paragraph)).toBe('Next paragraph');
  });

  it('flushes lists before other block types such as headings', () => {
    const json = mdxToJSON('- alpha\n# Heading');
    const [list, heading] = json.content ?? [];

    expect(list?.type).toBe('bulletList');
    expect(textFromFirstListItem(list)).toBe('alpha');
    expect(heading?.type).toBe('heading');
    expect(heading?.attrs?.level).toBe(1);
  });

  it('preserves ordering across multiple block transitions', () => {
    const json = mdxToJSON(['- first', 'Paragraph body', '- second', '- third', 'Tail'].join('\n'));

    expect(blockTypes(json.content)).toEqual(['bulletList', 'paragraph', 'bulletList', 'paragraph']);
    expect(textFromParagraph(json.content?.[1])).toBe('Paragraph body');
    expect(textFromFirstListItem(json.content?.[2])).toBe('second');
    expect(textFromParagraph(json.content?.[3])).toBe('Tail');
  });

  it('nests child bullets before trailing paragraphs when indentation increases', () => {
    const json = mdxToJSON(['- parent', '  - child', 'Paragraph tail'].join('\n'));
    const [list, paragraph] = json.content ?? [];

    expect(blockTypes(json.content)).toEqual(['bulletList', 'paragraph']);
    expect(list?.content).toHaveLength(1);

    const parentItem = list?.content?.[0];
    expect(textFromParagraph(parentItem?.content?.[0])).toBe('parent');
    const nested = parentItem?.content?.[1];
    expect(nested?.type).toBe('bulletList');
    expect(textFromParagraph(nested?.content?.[0]?.content?.[0])).toBe('child');

    expect(textFromParagraph(paragraph)).toBe('Paragraph tail');
  });

  it('handles mixed content where embeds split lists and paragraphs', () => {
    const mdx = [
      '- alpha',
      '<ImageFigure src="https://cdn.example.com/one.png" alt="one" caption="One" width={480} />',
      'Middle paragraph',
      '<VideoEmbed src="https://www.youtube.com/watch?v=abc123" title="Clip" aspectRatio={1.33} />',
      '- beta'
    ].join('\n');

    const json = mdxToJSON(mdx);

    expect(blockTypes(json.content)).toEqual([
      'bulletList',
      'imageFigure',
      'paragraph',
      'videoEmbed',
      'bulletList'
    ]);
    expect(textFromFirstListItem(json.content?.[0])).toBe('alpha');
    expect(textFromParagraph(json.content?.[2])).toBe('Middle paragraph');
    expect(textFromFirstListItem(json.content?.[4])).toBe('beta');
  });

  describe('nested lists', () => {
    it('ordered with nested bullet list flushes before trailing paragraph', () => {
      const mdx = [
        '1. Parent A',
        '   - Child A1',
        '   - Child A2',
        '2. Parent B',
        'Next paragraph.'
      ].join('\n');

      const json = mdxToJSON(mdx);
      const [outerList, trailingParagraph] = json.content ?? [];

      expect(blockTypes(json.content)).toEqual(['orderedList', 'paragraph']);
      expect(outerList?.type).toBe('orderedList');
      expect(outerList?.content).toHaveLength(2);

      const firstItem = outerList?.content?.[0];
      const parentParagraph = firstItem?.content?.[0];
      const nestedBullet = firstItem?.content?.[1];
      expect(parentParagraph?.type).toBe('paragraph');
      expect(textFromParagraph(parentParagraph)).toBe('Parent A');
      expect(nestedBullet?.type).toBe('bulletList');
      expect(nestedBullet?.content).toHaveLength(2);
      expect(textFromParagraph(nestedBullet?.content?.[0]?.content?.[0])).toBe('Child A1');
      expect(textFromParagraph(nestedBullet?.content?.[1]?.content?.[0])).toBe('Child A2');

      const secondItem = outerList?.content?.[1];
      expect(textFromParagraph(secondItem?.content?.[0])).toBe('Parent B');

      expect(trailingParagraph?.type).toBe('paragraph');
      expect(textFromParagraph(trailingParagraph)).toBe('Next paragraph.');
    });

    it('bullet with nested ordered list flushes before trailing paragraph', () => {
      const mdx = [
        '- Parent A',
        '  1. Child A1',
        '  2. Child A2',
        '- Parent B',
        'Next paragraph.'
      ].join('\n');

      const json = mdxToJSON(mdx);
      const [outerList, trailingParagraph] = json.content ?? [];

      expect(blockTypes(json.content)).toEqual(['bulletList', 'paragraph']);
      expect(outerList?.type).toBe('bulletList');
      expect(outerList?.content).toHaveLength(2);

      const firstItem = outerList?.content?.[0];
      const parentParagraph = firstItem?.content?.[0];
      const nestedOrdered = firstItem?.content?.[1];
      expect(parentParagraph?.type).toBe('paragraph');
      expect(textFromParagraph(parentParagraph)).toBe('Parent A');
      expect(nestedOrdered?.type).toBe('orderedList');
      expect(nestedOrdered?.content).toHaveLength(2);
      expect(textFromParagraph(nestedOrdered?.content?.[0]?.content?.[0])).toBe('Child A1');
      expect(textFromParagraph(nestedOrdered?.content?.[1]?.content?.[0])).toBe('Child A2');

      const secondItem = outerList?.content?.[1];
      expect(textFromParagraph(secondItem?.content?.[0])).toBe('Parent B');

      expect(trailingParagraph?.type).toBe('paragraph');
      expect(textFromParagraph(trailingParagraph)).toBe('Next paragraph.');
    });
  });

  describe('component parse', () => {
    it('ImageFigure supports single-quoted attributes', () => {
      const mdx = `<ImageFigure src='https://cdn.example.com/foo.png' caption='Foo' />`;
      const json = mdxToJSON(mdx);
      const node = json.content?.[0];

      expect(node?.type).toBe('imageFigure');
      expect(node?.attrs?.src).toBe('https://cdn.example.com/foo.png');
      expect(node?.attrs?.caption).toBe('Foo');
    });

    it('VideoEmbed supports single-quoted attributes', () => {
      const mdx = `<VideoEmbed src='https://www.youtube.com/watch?v=abc123' />`;
      const json = mdxToJSON(mdx);
      const node = json.content?.[0];

      expect(node?.type).toBe('videoEmbed');
      expect(node?.attrs?.src ?? '').toContain('abc123');
    });
  });
});
