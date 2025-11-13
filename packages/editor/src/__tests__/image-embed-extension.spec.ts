import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImageEmbedExtension } from '../extensions/image-figure';

/**
 * Test suite for the Image Embed extension (T033)
 *
 * Requirements from spec.md:
 * - FR-001: System MUST allow composing articles in-browser with image embeds
 * - FR-002: System MUST validate referenced media sizes (≤8 MB)
 * - Image embeds should support src, alt, width, and height attributes
 * - Size validation must warn when images exceed 8 MB limit
 */

describe('ImageEmbedExtension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      content: '<p>Test content</p>',
      extensions: [
        StarterKit,
        ImageEmbedExtension
      ]
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('basic image embed functionality', () => {
    it('should create an image embed with src', () => {
      const result = editor.commands.setImage({ src: 'https://example.com/image.jpg' });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode).toBeDefined();
      expect(imageNode?.attrs?.src).toBe('https://example.com/image.jpg');
    });

    it('should create an image with src and alt text', () => {
      editor.commands.setImage({
        src: 'https://example.com/photo.jpg',
        alt: 'A beautiful landscape'
      });

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode?.attrs?.src).toBe('https://example.com/photo.jpg');
      expect(imageNode?.attrs?.alt).toBe('A beautiful landscape');
    });

    it('should create an image with dimensions', () => {
      editor.commands.setImage({
        src: 'https://example.com/sized.jpg',
        alt: 'Test image',
        width: 800,
        height: 600
      });

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      const imgAttrs = imageNode?.attrs;
      expect(imgAttrs?.src).toBe('https://example.com/sized.jpg');
      expect(imgAttrs?.width).toBe(800);
      expect(imgAttrs?.height).toBe(600);
    });

    it('should allow image without alt text', () => {
      editor.commands.setImage({ src: 'https://example.com/no-alt.jpg' });

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode?.attrs?.src).toBe('https://example.com/no-alt.jpg');
      expect(imageNode?.attrs?.alt).toBeNull();
    });
  });

  describe('URL validation', () => {
    it('should accept https URLs', () => {
      const result = editor.commands.setImage({ src: 'https://cdn.example.com/image.png' });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode?.attrs?.src).toBe('https://cdn.example.com/image.png');
    });

    it('should accept http URLs', () => {
      const result = editor.commands.setImage({ src: 'http://example.com/image.jpg' });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode?.attrs?.src).toBe('http://example.com/image.jpg');
    });

    it('should accept relative URLs', () => {
      const result = editor.commands.setImage({ src: '/images/local.jpg' });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode?.attrs?.src).toBe('/images/local.jpg');
    });

    it('should reject javascript: protocol URLs', () => {
      const result = editor.commands.setImage({ src: 'javascript:alert("xss")' });

      // Should either reject or sanitize
      const doc = editor.getJSON();
      const hasDangerousURL = doc.content?.some(
        node => node.attrs?.src?.startsWith('javascript:')
      );
      expect(hasDangerousURL).toBe(false);
    });

    it('should reject data: URLs for security', () => {
      const result = editor.commands.setImage({
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      });

      // Data URLs should be rejected or sanitized for security
      const doc = editor.getJSON();
      const hasDataURL = doc.content?.some(
        node => node.attrs?.src?.startsWith('data:')
      );
      expect(hasDataURL).toBe(false);
    });
  });

  describe('dimension constraints', () => {
    it('should clamp width to maximum 2000px', () => {
      editor.commands.setImage({
        src: 'https://example.com/huge.jpg',
        width: 5000
      });

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      const width = imageNode?.attrs?.width;
      expect(width).toBeLessThanOrEqual(2000);
    });

    it('should clamp height to maximum 2000px', () => {
      editor.commands.setImage({
        src: 'https://example.com/tall.jpg',
        height: 3000
      });

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      const height = imageNode?.attrs?.height;
      expect(height).toBeLessThanOrEqual(2000);
    });

    it('should allow dimensions under maximum', () => {
      editor.commands.setImage({
        src: 'https://example.com/normal.jpg',
        width: 800,
        height: 600
      });

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode?.attrs?.width).toBe(800);
      expect(imageNode?.attrs?.height).toBe(600);
    });

    it('should handle missing dimensions gracefully', () => {
      editor.commands.setImage({ src: 'https://example.com/no-size.jpg' });

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode?.type).toBe('image');
      // Width/height can be null or undefined
      expect([null, undefined]).toContain(imageNode?.attrs?.width);
    });
  });

  describe('content preservation and updates', () => {
    it('should allow inserting multiple images with different sources', () => {
      editor.commands.setImage({ src: 'https://example.com/first.jpg' });
      editor.commands.setImage({ src: 'https://example.com/second.jpg' });

      const doc = editor.getJSON();
      const imageNodes = doc.content?.filter(node => node.type === 'image');
      expect(imageNodes?.length).toBeGreaterThanOrEqual(1);

      // At least one image should exist
      const hasFirstImage = imageNodes?.some(node =>
        node.attrs?.src === 'https://example.com/first.jpg'
      );
      expect(hasFirstImage).toBe(true);
    });

    it('should preserve image attributes across editor state', () => {
      editor.commands.setImage({
        src: 'https://example.com/persistent.jpg',
        alt: 'Persistent image',
        width: 400,
        height: 300
      });

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');

      // All attributes should persist
      expect(imageNode?.attrs?.src).toBe('https://example.com/persistent.jpg');
      expect(imageNode?.attrs?.alt).toBe('Persistent image');
      expect(imageNode?.attrs?.width).toBe(400);
      expect(imageNode?.attrs?.height).toBe(300);
    });

    it('should allow replacing image by setting new content', () => {
      editor.commands.setImage({
        src: 'https://example.com/old.jpg',
        width: 400
      });

      // Clear and set new image
      editor.commands.setContent('');
      editor.commands.setImage({
        src: 'https://example.com/new.jpg',
        width: 800
      });

      const doc = editor.getJSON();
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode?.attrs?.src).toBe('https://example.com/new.jpg');
      expect(imageNode?.attrs?.width).toBe(800);
    });
  });

  describe('MDX serialization compatibility', () => {
    it('should render image with proper HTML structure', () => {
      editor.commands.setImage({
        src: 'https://example.com/test.jpg',
        alt: 'Test image'
      });

      const html = editor.getHTML();
      expect(html).toContain('<img');
      expect(html).toContain('src="https://example.com/test.jpg"');
      expect(html).toContain('alt="Test image"');
    });

    it('should render image with dimensions in HTML', () => {
      editor.commands.setImage({
        src: 'https://example.com/sized.jpg',
        width: 800,
        height: 600
      });

      const html = editor.getHTML();
      expect(html).toContain('width="800"');
      expect(html).toContain('height="600"');
    });

    it('should escape special characters in alt text', () => {
      editor.commands.setImage({
        src: 'https://example.com/img.jpg',
        alt: 'Image with "quotes" & <tags>'
      });

      const html = editor.getHTML();
      // HTML should escape special characters
      expect(html).not.toContain('alt="Image with "quotes" & <tags>"');
      expect(html).toMatch(/alt=".*&quot;.*"/);
    });
  });

  describe('integration with other content', () => {
    it('should insert image between paragraphs', () => {
      editor.commands.setContent('<p>Before</p><p>After</p>');

      // Move to first paragraph and insert image after
      editor.commands.focus('end');
      editor.commands.setImage({ src: 'https://example.com/middle.jpg' });

      const doc = editor.getJSON();
      expect(doc.content?.length).toBeGreaterThanOrEqual(2);

      // Should have an image node
      const hasImage = doc.content?.some(node => node.type === 'image');
      expect(hasImage).toBe(true);
    });

    it('should allow deleting image', () => {
      editor.commands.setImage({ src: 'https://example.com/delete-me.jpg' });
      const initialImage = editor.getJSON().content?.find(node => node.type === 'image');
      expect(initialImage).toBeDefined();

      // Select and delete
      editor.commands.selectAll();
      editor.commands.deleteSelection();

      const doc = editor.getJSON();
      const hasImage = doc.content?.some(node => node.type === 'image');
      expect(hasImage).toBe(false);
    });
  });

  describe('accessibility and best practices', () => {
    it('should preserve alt text for screen readers', () => {
      editor.commands.setImage({
        src: 'https://example.com/accessible.jpg',
        alt: 'Detailed description for screen readers'
      });

      const doc = editor.getJSON();
      // Image node should be in content
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode?.attrs?.alt).toBe('Detailed description for screen readers');
    });

    it('should handle empty alt text (decorative images)', () => {
      editor.commands.setImage({
        src: 'https://example.com/decorative.jpg',
        alt: ''
      });

      const doc = editor.getJSON();
      // Empty string is valid for decorative images
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode?.attrs?.alt).toBe('');
    });
  });

  describe('image loading states', () => {
    it('should store image attributes without validating file size at editor level', () => {
      // File size validation happens at import/upload time, not in editor
      editor.commands.setImage({
        src: 'https://example.com/potentially-large.jpg'
      });

      const doc = editor.getJSON();
      // Find the image node in content
      const imageNode = doc.content?.find(node => node.type === 'image');
      expect(imageNode).toBeDefined();
      expect(imageNode?.attrs?.src).toBe('https://example.com/potentially-large.jpg');
    });
  });
});
