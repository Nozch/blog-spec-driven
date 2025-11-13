import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VideoEmbedExtension } from '../extensions/video-embed';

/**
 * Test suite for the Video Embed extension (T034)
 *
 * Requirements from spec.md:
 * - FR-001: System MUST allow composing articles in-browser with video embeds
 * - Provider allowlist: Only YouTube, Vimeo, Dailymotion allowed
 * - URL validation must prevent XSS and unauthorized providers
 * - Support src, width, height, and aspect ratio attributes
 */

describe('VideoEmbedExtension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      content: '<p>Test content</p>',
      extensions: [
        StarterKit,
        VideoEmbedExtension
      ]
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('basic video embed functionality', () => {
    it('should create a video embed with YouTube URL', () => {
      const result = editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode).toBeDefined();
      expect(videoNode?.attrs?.src).toContain('youtube.com');
    });

    it('should create a video embed with Vimeo URL', () => {
      editor.commands.setVideo({
        src: 'https://vimeo.com/123456789'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.src).toContain('vimeo.com');
    });

    it('should create a video embed with Dailymotion URL', () => {
      editor.commands.setVideo({
        src: 'https://www.dailymotion.com/video/x7tgad0'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.src).toContain('dailymotion.com');
    });

    it('should create a video with dimensions', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        width: 640,
        height: 360
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.width).toBe(640);
      expect(videoNode?.attrs?.height).toBe(360);
    });
  });

  describe('provider allowlist validation', () => {
    it('should accept YouTube embed URLs', () => {
      const result = editor.commands.setVideo({
        src: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode).toBeDefined();
    });

    it('should accept YouTube short URLs', () => {
      const result = editor.commands.setVideo({
        src: 'https://youtu.be/dQw4w9WgXcQ'
      });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode).toBeDefined();
    });

    it('should accept Vimeo player URLs', () => {
      const result = editor.commands.setVideo({
        src: 'https://player.vimeo.com/video/123456789'
      });
      expect(result).toBe(true);

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode).toBeDefined();
    });

    it('should reject unauthorized provider (example.com)', () => {
      const result = editor.commands.setVideo({
        src: 'https://example.com/video/123'
      });

      // Should fail or not create video node
      expect(result).toBe(false);
    });

    it('should reject javascript: protocol URLs', () => {
      const result = editor.commands.setVideo({
        src: 'javascript:alert("xss")'
      });

      expect(result).toBe(false);

      const doc = editor.getJSON();
      const hasVideo = doc.content?.some(node => node.type === 'video');
      expect(hasVideo).toBe(false);
    });

    it('should reject data: URLs for security', () => {
      const result = editor.commands.setVideo({
        src: 'data:text/html,<script>alert("xss")</script>'
      });

      expect(result).toBe(false);

      const doc = editor.getJSON();
      const hasVideo = doc.content?.some(node => node.type === 'video');
      expect(hasVideo).toBe(false);
    });

    it('should reject file: protocol URLs', () => {
      const result = editor.commands.setVideo({
        src: 'file:///etc/passwd'
      });

      expect(result).toBe(false);
    });
  });

  describe('URL normalization and embed conversion', () => {
    it('should normalize YouTube watch URL to embed URL', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');

      // Should convert to embed format
      expect(videoNode?.attrs?.src).toMatch(/youtube\.com\/embed\//);
    });

    it('should normalize YouTube short URL to embed URL', () => {
      editor.commands.setVideo({
        src: 'https://youtu.be/dQw4w9WgXcQ'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.src).toMatch(/youtube\.com\/embed\//);
    });

    it('should normalize Vimeo URL to player URL', () => {
      editor.commands.setVideo({
        src: 'https://vimeo.com/123456789'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.src).toMatch(/player\.vimeo\.com\/video\//);
    });

    it('should keep already-normalized YouTube embed URLs unchanged', () => {
      const embedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      editor.commands.setVideo({ src: embedUrl });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.src).toBe(embedUrl);
    });
  });

  describe('dimension constraints', () => {
    it('should clamp width to maximum 1920px', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        width: 3000
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.width).toBeLessThanOrEqual(1920);
    });

    it('should clamp height to maximum 1080px', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        height: 1500
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.height).toBeLessThanOrEqual(1080);
    });

    it('should allow dimensions under maximum', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        width: 640,
        height: 360
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.width).toBe(640);
      expect(videoNode?.attrs?.height).toBe(360);
    });

    it('should handle missing dimensions gracefully', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.type).toBe('video');
      // Width/height can be null or undefined or have defaults
      expect(videoNode).toBeDefined();
    });
  });

  describe('aspect ratio support', () => {
    it('should support 16:9 aspect ratio', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        aspectRatio: '16:9'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.aspectRatio).toBe('16:9');
    });

    it('should support 4:3 aspect ratio', () => {
      editor.commands.setVideo({
        src: 'https://vimeo.com/123456789',
        aspectRatio: '4:3'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.aspectRatio).toBe('4:3');
    });

    it('should use default 16:9 aspect ratio when not specified', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      // Default aspect ratio should be 16:9
      expect(videoNode?.attrs?.aspectRatio).toBe('16:9');
    });
  });

  describe('provider detection', () => {
    it('should detect YouTube as provider', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.provider).toBe('youtube');
    });

    it('should detect Vimeo as provider', () => {
      editor.commands.setVideo({
        src: 'https://vimeo.com/123456789'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.provider).toBe('vimeo');
    });

    it('should detect Dailymotion as provider', () => {
      editor.commands.setVideo({
        src: 'https://www.dailymotion.com/video/x7tgad0'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');
      expect(videoNode?.attrs?.provider).toBe('dailymotion');
    });
  });

  describe('content preservation and integration', () => {
    it('should allow inserting multiple videos', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });
      editor.commands.setVideo({
        src: 'https://vimeo.com/123456789'
      });

      const doc = editor.getJSON();
      const videoNodes = doc.content?.filter(node => node.type === 'video');
      expect(videoNodes?.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow deleting video', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      const initialVideo = editor.getJSON().content?.find(node => node.type === 'video');
      expect(initialVideo).toBeDefined();

      // Select and delete
      editor.commands.selectAll();
      editor.commands.deleteSelection();

      const doc = editor.getJSON();
      const hasVideo = doc.content?.some(node => node.type === 'video');
      expect(hasVideo).toBe(false);
    });

    it('should preserve video attributes across editor state', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        width: 640,
        height: 360,
        aspectRatio: '16:9'
      });

      const doc = editor.getJSON();
      const videoNode = doc.content?.find(node => node.type === 'video');

      // All attributes should persist
      expect(videoNode?.attrs?.src).toBeDefined();
      expect(videoNode?.attrs?.width).toBe(640);
      expect(videoNode?.attrs?.height).toBe(360);
      expect(videoNode?.attrs?.aspectRatio).toBe('16:9');
      expect(videoNode?.attrs?.provider).toBeDefined();
    });
  });

  describe('MDX serialization compatibility', () => {
    it('should render video with iframe structure', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      const html = editor.getHTML();
      expect(html).toContain('iframe');
      expect(html).toMatch(/youtube\.com\/embed\//);
    });

    it('should render video with dimensions in HTML', () => {
      editor.commands.setVideo({
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        width: 640,
        height: 360
      });

      const html = editor.getHTML();
      expect(html).toContain('width="640"');
      expect(html).toContain('height="360"');
    });
  });
});
