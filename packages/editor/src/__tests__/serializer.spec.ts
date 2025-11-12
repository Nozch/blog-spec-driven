import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { jsonToMDX } from '../editor';

const doc = (content: JSONContent[]): JSONContent => ({
  type: 'doc',
  content
});

const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }]
});

const listItem = (content: JSONContent[]): JSONContent => ({
  type: 'listItem',
  content
});

const bulletList = (items: JSONContent[]): JSONContent => ({
  type: 'bulletList',
  content: items
});

const orderedList = (items: JSONContent[]): JSONContent => ({
  type: 'orderedList',
  content: items
});

const imageFigure = (): JSONContent => ({
  type: 'imageFigure',
  attrs: {
    src: 'https://cdn.example.com/figure.png',
    alt: 'example alt',
    caption: 'Example caption',
    width: 480
  }
});

describe('jsonToMDX', () => {
  it('preserves nested lists (unordered in ordered / ordered in unordered)', () => {
    const nestedDoc = doc([
      orderedList([
        listItem([
          paragraph('Parent Ordered'),
          bulletList([
            listItem([paragraph('Child Bullet A1')]),
            listItem([paragraph('Child Bullet A2')])
          ])
        ]),
        listItem([paragraph('Parent Ordered B')])
      ]),
      bulletList([
        listItem([
          paragraph('Parent Bullet'),
          orderedList([
            listItem([paragraph('Child Ordered B1')]),
            listItem([paragraph('Child Ordered B2')])
          ])
        ]),
        listItem([paragraph('Parent Bullet C')])
      ])
    ]);

    const mdx = jsonToMDX(nestedDoc);

    expect(mdx).toMatch(/1\. Parent Ordered[\s\S]*\n {2,4}- Child Bullet A1/);
    expect(mdx).toMatch(/1\. Parent Ordered[\s\S]*\n {2,4}- Child Bullet A2/);
    expect(mdx).toMatch(/- Parent Bullet[\s\S]*\n {2,4}1\. Child Ordered B1/);
    expect(mdx).toMatch(/- Parent Bullet[\s\S]*\n {2,4}2\. Child Ordered B2/);
  });

  it('preserves multiple paragraphs within a single list item', () => {
    const multiParagraphDoc = doc([
      bulletList([
        listItem([paragraph('Line 1'), paragraph('Line 2 (same item)')])
      ])
    ]);

    const mdx = jsonToMDX(multiParagraphDoc);

    expect(mdx).toMatch(/- Line 1\s*\n(?:\s*\n)? {2,4}Line 2 \(same item\)/);
  });

  it('preserves non-paragraph child blocks inside list items (e.g., ImageFigure/VideoEmbed)', () => {
    const embedDoc = doc([
      bulletList([
        listItem([paragraph('Has embed'), imageFigure()])
      ])
    ]);

    const mdx = jsonToMDX(embedDoc);

    expect(mdx).toMatch(/- Has embed[\s\S]*\n {2,4}<ImageFigure\b/);
  });
});
