import { describe, it, expect } from 'vitest';
import { type JSONContent } from '@tiptap/core';
import { serializeTipTapToMDX } from '../serializers/mdx-serializer';

/**
 * Test suite for TipTap to MDX Serializer (T037)
 *
 * Requirements from spec.md and tasks.md:
 * - FR-001: Support all formatting controls (headings, bold, italic, code blocks, image/video embeds)
 * - T037: Implement TipTap to MDX serializer in packages/editor/src/serializers/mdx-serializer.ts
 * - Must serialize TipTap JSON to valid MDX format
 * - Must handle all custom extensions (T030-T035)
 * - Appearance settings are stored separately (NOT in MDX)
 */

describe('MDX Serializer', () => {
  describe('basic content serialization', () => {
    it('should serialize empty document to empty string', () => {
      const json: JSONContent = {
        type: 'doc',
        content: []
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('');
    });

    it('should serialize simple paragraph', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('Hello world');
    });

    it('should serialize multiple paragraphs with blank lines', () => {
      const json: JSONContent = {
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
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('First paragraph\n\nSecond paragraph');
    });
  });

  describe('heading serialization (T030)', () => {
    it('should serialize heading level 1', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Main Title' }]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('# Main Title');
    });

    it('should serialize heading level 2', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Subtitle' }]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('## Subtitle');
    });

    it('should serialize heading level 3', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Section' }]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('### Section');
    });

    it('should serialize heading level 4', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 4 },
            content: [{ type: 'text', text: 'Subsection' }]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('#### Subsection');
    });
  });

  describe('text style serialization (T031)', () => {
    it('should serialize bold text', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'bold text',
                marks: [{ type: 'bold' }]
              }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('**bold text**');
    });

    it('should serialize italic text', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'italic text',
                marks: [{ type: 'italic' }]
              }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('*italic text*');
    });

    it('should serialize inline code', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'code',
                marks: [{ type: 'code' }]
              }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('`code`');
    });

    it('should serialize mixed text with multiple styles', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Normal text ' },
              { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' and ' },
              { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
              { type: 'text', text: ' and ' },
              { type: 'text', text: 'code', marks: [{ type: 'code' }] }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('Normal text **bold** and *italic* and `code`');
    });
  });

  describe('code block serialization (T032)', () => {
    it('should serialize code block without language', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: null },
            content: [
              {
                type: 'text',
                text: 'const x = 42;'
              }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('```\nconst x = 42;\n```');
    });

    it('should serialize code block with language', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [
              {
                type: 'text',
                text: 'function hello(): string {\n  return "world";\n}'
              }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('```typescript\nfunction hello(): string {\n  return "world";\n}\n```');
    });

    it('should serialize empty code block', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [
              {
                type: 'text',
                text: ''
              }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('```javascript\n\n```');
    });
  });

  describe('image embed serialization (T033)', () => {
    it('should serialize image with all attributes', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'imageFigure',
            attrs: {
              src: 'https://example.com/image.jpg',
              alt: 'Example image',
              caption: 'This is a caption',
              width: 720
            }
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('<ImageFigure src={"https://example.com/image.jpg"} alt={"Example image"} caption={"This is a caption"} width={720} />');
    });

    it('should serialize image with minimal attributes', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'imageFigure',
            attrs: {
              src: 'https://example.com/photo.png',
              alt: '',
              caption: ''
            }
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('<ImageFigure src={"https://example.com/photo.png"} alt={""} caption={""} />');
    });

    it('should serialize image with special characters in alt text', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'imageFigure',
            attrs: {
              src: 'https://example.com/image.jpg',
              alt: 'Image with "quotes" and \\backslashes',
              caption: 'Caption with special chars: <>&',
              width: 500
            }
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      // JSON.stringify should handle escaping
      expect(mdx).toContain('alt={"Image with \\"quotes\\" and \\\\backslashes"}');
      expect(mdx).toContain('caption={"Caption with special chars: <>&"}');
    });
  });

  describe('video embed serialization (T034)', () => {
    it('should serialize YouTube video with all attributes', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'videoEmbed',
            attrs: {
              src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
              title: 'Example Video',
              provider: 'youtube',
              aspectRatio: 1.7777777777777777
            }
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('<VideoEmbed src={"https://www.youtube.com/embed/dQw4w9WgXcQ"} title={"Example Video"} provider={"youtube"} aspectRatio={1.7777777777777777} />');
    });

    it('should serialize Vimeo video', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'videoEmbed',
            attrs: {
              src: 'https://player.vimeo.com/video/123456789',
              title: 'Vimeo Video',
              provider: 'vimeo',
              aspectRatio: 1.7777777777777777
            }
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('<VideoEmbed src={"https://player.vimeo.com/video/123456789"} title={"Vimeo Video"} provider={"vimeo"} aspectRatio={1.7777777777777777} />');
    });

    it('should serialize video with custom aspect ratio', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'videoEmbed',
            attrs: {
              src: 'https://www.youtube.com/embed/test',
              title: '',
              provider: 'youtube',
              aspectRatio: 2.35
            }
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toContain('aspectRatio={2.35}');
    });
  });

  describe('list serialization', () => {
    it('should serialize bullet list', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'First item' }]
                  }
                ]
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Second item' }]
                  }
                ]
              }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('- First item\n- Second item');
    });

    it('should serialize ordered list', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'First step' }]
                  }
                ]
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Second step' }]
                  }
                ]
              }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('1. First step\n2. Second step');
    });

    it('should serialize nested bullet lists', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Parent item' }]
                  },
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [
                          {
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Nested item' }]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('- Parent item\n  - Nested item');
    });
  });

  describe('complex document serialization', () => {
    it('should serialize article with multiple content types', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'My Blog Post' }]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'This is an ' },
              { type: 'text', text: 'introduction', marks: [{ type: 'italic' }] },
              { type: 'text', text: ' paragraph.' }
            ]
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Code Example' }]
          },
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [
              {
                type: 'text',
                text: 'const greeting = "Hello";'
              }
            ]
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Media' }]
          },
          {
            type: 'imageFigure',
            attrs: {
              src: 'https://example.com/img.jpg',
              alt: 'Example',
              caption: 'A great image',
              width: 600
            }
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toContain('# My Blog Post');
      expect(mdx).toContain('This is an *introduction* paragraph.');
      expect(mdx).toContain('## Code Example');
      expect(mdx).toContain('```typescript');
      expect(mdx).toContain('## Media');
      expect(mdx).toContain('<ImageFigure');
    });
  });

  describe('edge cases', () => {
    it('should handle hard breaks', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Line 1' },
              { type: 'hardBreak' },
              { type: 'text', text: 'Line 2' }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('Line 1  \nLine 2');
    });

    it('should handle empty list items', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: []
                  }
                ]
              }
            ]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      expect(mdx).toBe('-');
    });

    it('should handle unknown node types gracefully', () => {
      const json: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'unknownType',
            content: [{ type: 'text', text: 'should be ignored' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Valid paragraph' }]
          }
        ]
      };

      const mdx = serializeTipTapToMDX(json);

      // Should skip unknown types and serialize valid content
      expect(mdx).toBe('Valid paragraph');
    });
  });
});
