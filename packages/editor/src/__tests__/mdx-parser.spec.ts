import { describe, it, expect } from 'vitest';
import { type JSONContent } from '@tiptap/core';
import { parseMDXToTipTap } from '../parsers/mdx-parser';

/**
 * Test suite for MDX to TipTap JSON Parser (T038)
 *
 * Requirements from spec.md and tasks.md:
 * - FR-001: Support all formatting controls (headings, bold, italic, code blocks, image/video embeds)
 * - T038: Implement MDX to TipTap JSON parser in packages/editor/src/parsers/mdx-parser.ts
 * - Must parse MDX format to TipTap JSON structure
 * - Must handle all custom extensions (T030-T035)
 * - Appearance settings are stored separately (NOT in MDX)
 * - Should be the inverse of the serializer (T037)
 */

describe('MDX Parser', () => {
  describe('basic content parsing', () => {
    it('should parse empty string to empty document', () => {
      const mdx = '';

      const json = parseMDXToTipTap(mdx);

      expect(json).toEqual({
        type: 'doc',
        content: []
      });
    });

    it('should parse simple paragraph', () => {
      const mdx = 'Hello world';

      const json = parseMDXToTipTap(mdx);

      expect(json).toEqual({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }]
          }
        ]
      });
    });

    it('should parse multiple paragraphs separated by blank lines', () => {
      const mdx = 'First paragraph\n\nSecond paragraph';

      const json = parseMDXToTipTap(mdx);

      expect(json).toEqual({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First paragraph' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second paragraph' }]
          }
        ]
      });
    });

    it('should handle CRLF line endings', () => {
      const mdx = 'First paragraph\r\n\r\nSecond paragraph';

      const json = parseMDXToTipTap(mdx);

      expect(json).toEqual({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First paragraph' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second paragraph' }]
          }
        ]
      });
    });
  });

  describe('heading parsing (T030)', () => {
    it('should parse heading level 1', () => {
      const mdx = '# Main Title';

      const json = parseMDXToTipTap(mdx);

      expect(json).toEqual({
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Main Title' }]
          }
        ]
      });
    });

    it('should parse heading level 2', () => {
      const mdx = '## Subtitle';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toEqual({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Subtitle' }]
      });
    });

    it('should parse heading level 3', () => {
      const mdx = '### Section';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toEqual({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Section' }]
      });
    });

    it('should parse heading level 4', () => {
      const mdx = '#### Subsection';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toEqual({
        type: 'heading',
        attrs: { level: 4 },
        content: [{ type: 'text', text: 'Subsection' }]
      });
    });

    it('should parse heading with inline formatting', () => {
      const mdx = '## **Bold** and *italic* heading';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toMatchObject({
        type: 'heading',
        attrs: { level: 2 }
      });
      expect(json.content?.[0].content).toHaveLength(4);
    });
  });

  describe('text styles parsing (T031)', () => {
    it('should parse bold text', () => {
      const mdx = '**bold text**';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0].content).toEqual([
        {
          type: 'text',
          text: 'bold text',
          marks: [{ type: 'bold' }]
        }
      ]);
    });

    it('should parse italic text', () => {
      const mdx = '*italic text*';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0].content).toEqual([
        {
          type: 'text',
          text: 'italic text',
          marks: [{ type: 'italic' }]
        }
      ]);
    });

    it('should parse inline code', () => {
      const mdx = '`code snippet`';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0].content).toEqual([
        {
          type: 'text',
          text: 'code snippet',
          marks: [{ type: 'code' }]
        }
      ]);
    });

    it('should parse mixed inline formatting', () => {
      const mdx = 'Text with **bold**, *italic*, and `code`';

      const json = parseMDXToTipTap(mdx);

      const content = json.content?.[0].content;
      expect(content).toBeDefined();
      expect(content).toHaveLength(6);
      expect(content?.[1]).toMatchObject({
        text: 'bold',
        marks: [{ type: 'bold' }]
      });
      expect(content?.[3]).toMatchObject({
        text: 'italic',
        marks: [{ type: 'italic' }]
      });
      expect(content?.[5]).toMatchObject({
        text: 'code',
        marks: [{ type: 'code' }]
      });
    });
  });

  describe('code block parsing (T032)', () => {
    it('should parse code block without language', () => {
      const mdx = '```\nconst x = 1;\nconsole.log(x);\n```';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toEqual({
        type: 'codeBlock',
        attrs: {
          language: null
        },
        content: [
          {
            type: 'text',
            text: 'const x = 1;\nconsole.log(x);'
          }
        ]
      });
    });

    it('should parse code block with language', () => {
      const mdx = '```typescript\nfunction hello() {\n  return "world";\n}\n```';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toEqual({
        type: 'codeBlock',
        attrs: {
          language: 'typescript'
        },
        content: [
          {
            type: 'text',
            text: 'function hello() {\n  return "world";\n}'
          }
        ]
      });
    });

    it('should preserve indentation in code blocks', () => {
      const mdx = '```python\ndef hello():\n    return "world"\n```';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0].content?.[0].text).toBe('def hello():\n    return "world"');
    });
  });

  describe('list parsing', () => {
    it('should parse simple bullet list', () => {
      const mdx = '- Item 1\n- Item 2\n- Item 3';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toMatchObject({
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }]
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }]
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 3' }] }]
          }
        ]
      });
    });

    it('should parse simple ordered list', () => {
      const mdx = '1. First\n2. Second\n3. Third';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toMatchObject({
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }]
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }]
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Third' }] }]
          }
        ]
      });
    });

    it('should parse nested bullet lists', () => {
      const mdx = '- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0].type).toBe('bulletList');
      const firstItem = json.content?.[0].content?.[0];
      expect(firstItem?.content).toHaveLength(2); // paragraph + nested list
      expect(firstItem?.content?.[1].type).toBe('bulletList');
    });
  });

  describe('image embed parsing (T033)', () => {
    it('should parse ImageFigure component with all attributes', () => {
      const mdx = '<ImageFigure src={"https://example.com/image.jpg"} alt={"A test image"} caption={"Test caption"} width={800} />';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toEqual({
        type: 'imageFigure',
        attrs: {
          src: 'https://example.com/image.jpg',
          alt: 'A test image',
          caption: 'Test caption',
          width: 800
        }
      });
    });

    it('should parse ImageFigure without optional width', () => {
      const mdx = '<ImageFigure src={"https://example.com/image.jpg"} alt={"Alt text"} caption={"Caption"} />';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toEqual({
        type: 'imageFigure',
        attrs: {
          src: 'https://example.com/image.jpg',
          alt: 'Alt text',
          caption: 'Caption',
          width: undefined
        }
      });
    });

    it('should sanitize invalid image URLs', () => {
      const mdx = '<ImageFigure src={"javascript:alert(1)"} alt={""} caption={""} />';

      const json = parseMDXToTipTap(mdx);

      // Should not create imageFigure for invalid URL - treats as paragraph text instead
      expect(json.content?.[0]?.type).toBe('paragraph');
      // Should not have imageFigure node
      expect(json.content?.find((node) => node.type === 'imageFigure')).toBeUndefined();
    });

    it('should clamp image width to valid range', () => {
      const mdx = '<ImageFigure src={"https://example.com/image.jpg"} alt={""} caption={""} width={5000} />';

      const json = parseMDXToTipTap(mdx);

      const width = json.content?.[0]?.attrs?.width;
      expect(width).toBeLessThanOrEqual(2000); // IMAGE_WIDTH_RANGE.max
    });
  });

  describe('video embed parsing (T034)', () => {
    it('should parse VideoEmbed component with all attributes', () => {
      const mdx = '<VideoEmbed src={"https://youtube.com/watch?v=abc123"} title={"Test video"} provider={"youtube"} aspectRatio={1.77777778} />';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0]).toMatchObject({
        type: 'videoEmbed',
        attrs: {
          src: expect.stringContaining('youtube'),
          title: 'Test video',
          provider: 'youtube',
          aspectRatio: expect.any(Number)
        }
      });
    });

    it('should parse VideoEmbed without optional aspectRatio', () => {
      const mdx = '<VideoEmbed src={"https://youtube.com/watch?v=abc123"} title={"Video"} provider={"youtube"} />';

      const json = parseMDXToTipTap(mdx);

      expect(json.content?.[0].type).toBe('videoEmbed');
      expect(json.content?.[0].attrs).toMatchObject({
        title: 'Video',
        provider: 'youtube'
      });
    });
  });

  describe('round-trip compatibility (T037 ↔ T038)', () => {
    it('should parse serialized MDX back to equivalent JSON', async () => {
      const original: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Text with ' },
              { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' and ' },
              { type: 'text', text: 'italic', marks: [{ type: 'italic' }] }
            ]
          }
        ]
      };

      // Import serializer to test round-trip
      const { serializeTipTapToMDX } = await import('../serializers/mdx-serializer');
      const mdx = serializeTipTapToMDX(original);
      const parsed = parseMDXToTipTap(mdx);

      expect(parsed).toEqual(original);
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace-only input', () => {
      const mdx = '   \n\n  \n  ';

      const json = parseMDXToTipTap(mdx);

      expect(json).toEqual({
        type: 'doc',
        content: []
      });
    });

    it('should handle unknown component gracefully', () => {
      const mdx = '<UnknownComponent foo="bar" />';

      const json = parseMDXToTipTap(mdx);

      // Should treat as paragraph or skip
      expect(json.content).toBeDefined();
    });

    it('should handle malformed JSX gracefully', () => {
      const mdx = '<ImageFigure src={"unclosed';

      const json = parseMDXToTipTap(mdx);

      // Should not throw, may treat as paragraph
      expect(json).toBeDefined();
      expect(json.type).toBe('doc');
    });
  });
});
