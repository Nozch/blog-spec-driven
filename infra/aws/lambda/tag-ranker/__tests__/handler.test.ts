/**
 * Tests for Tag Ranker Lambda Handler
 *
 * Requirements:
 * - FR-003: Hybrid scoring (70% semantic + 30% frequency)
 * - FR-003: Return up to 5 tags with ≥0.3 threshold
 * - SC-005: Complete within 3s
 * - Session 2025-11-14: Handle multilingual content
 * - Edge Cases: Handle empty content, short content, no quality candidates
 *
 * @module handler.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler, TagSuggestionEvent, TagSuggestionResponse } from '../handler';
import type { KeywordCandidate } from '../opensearch-client';

// Mock dependencies
const mockOpenSearchClient = {
  extractKeywords: vi.fn(),
  close: vi.fn(),
};

const mockModel2VecLoader = {
  load: vi.fn(),
  embed: vi.fn(),
  computeSimilarity: vi.fn(),
  unload: vi.fn(),
};

vi.mock('../opensearch-client', () => ({
  OpenSearchClient: vi.fn(() => mockOpenSearchClient),
  createOpenSearchClient: vi.fn(() => mockOpenSearchClient),
  OpenSearchError: class OpenSearchError extends Error {},
}));

vi.mock('../model-loader', () => ({
  Model2VecLoader: vi.fn(() => mockModel2VecLoader),
  createModel2VecLoader: vi.fn(() => mockModel2VecLoader),
  ModelLoadError: class ModelLoadError extends Error {},
}));

describe('Tag Ranker Lambda Handler', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Hybrid Scoring Algorithm', () => {
    it('should combine semantic (70%) and frequency (30%) scores correctly', async () => {
      // Arrange
      const event: TagSuggestionEvent = {
        content: 'TypeScript is a programming language with static typing. It provides excellent tooling support and type safety for large-scale applications. Many developers prefer TypeScript over JavaScript.',
        minScore: 0.3,
        maxTags: 5,
      };

      // Mock OpenSearch keywords with frequency scores
      const keywords: KeywordCandidate[] = [
        { text: 'typescript', frequency: 1.0 }, // Highest frequency
        { text: 'programming', frequency: 0.8 },
        { text: 'language', frequency: 0.6 },
        { text: 'static', frequency: 0.4 },
        { text: 'typing', frequency: 0.2 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});

      // Mock content embedding
      const contentEmbedding = [0.5, 0.5, 0.5];
      mockModel2VecLoader.embed.mockResolvedValueOnce(contentEmbedding);

      // Mock keyword embeddings and similarity scores
      // typescript: high semantic similarity (0.9)
      // programming: medium semantic similarity (0.7)
      // language: medium semantic similarity (0.6)
      // static: low semantic similarity (0.4)
      // typing: low semantic similarity (0.3)
      const keywordEmbeddings = [
        [0.9, 0.1, 0.1], // typescript
        [0.7, 0.2, 0.1], // programming
        [0.6, 0.3, 0.1], // language
        [0.4, 0.4, 0.2], // static
        [0.3, 0.5, 0.2], // typing
      ];

      let embedCallCount = 0;
      mockModel2VecLoader.embed.mockImplementation(async (text: string) => {
        if (embedCallCount === 0) {
          embedCallCount++;
          return contentEmbedding;
        }
        return keywordEmbeddings[embedCallCount++ - 1];
      });

      mockModel2VecLoader.computeSimilarity.mockImplementation(
        (emb1: number[], emb2: number[]) => {
          // Simple dot product for testing
          return emb1.reduce((sum, val, i) => sum + val * emb2[i], 0);
        }
      );

      // Act
      const response = await handler(event);

      // Debug
      if (!response.success) {
        console.log('Error:', response.error);
        console.log('Full response:', response);
      }

      // Assert
      expect(response.success).toBe(true);
      expect(response.tags).toBeDefined();
      expect(response.tags!.length).toBeGreaterThan(0);

      // Verify hybrid scoring: score = 0.7 * semantic + 0.3 * frequency
      // typescript: 0.7 * 0.45 + 0.3 * 1.0 = 0.315 + 0.3 = 0.615
      // programming: 0.7 * 0.35 + 0.3 * 0.8 = 0.245 + 0.24 = 0.485
      const typescriptTag = response.tags!.find((t) => t.tag === 'typescript');
      expect(typescriptTag).toBeDefined();
      expect(typescriptTag!.score).toBeGreaterThan(0.3); // Above threshold
    });

    it('should normalize semantic scores to 0-1 range before combining', async () => {
      const event: TagSuggestionEvent = {
        content: 'React hooks like useState and useEffect make functional components more powerful and easier to use in modern applications. They provide state management without classes.',
        minScore: 0.3,
        maxTags: 5,
      };

      const keywords: KeywordCandidate[] = [
        { text: 'react', frequency: 1.0 },
        { text: 'hooks', frequency: 0.9 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});

      const contentEmbedding = [1.0, 0, 0];
      mockModel2VecLoader.embed.mockResolvedValueOnce(contentEmbedding);
      mockModel2VecLoader.embed.mockResolvedValueOnce([0.8, 0.2, 0]);
      mockModel2VecLoader.embed.mockResolvedValueOnce([0.6, 0.4, 0]);

      // Raw similarity scores (may be negative or > 1)
      mockModel2VecLoader.computeSimilarity.mockReturnValueOnce(0.8);
      mockModel2VecLoader.computeSimilarity.mockReturnValueOnce(-0.2);

      const response = await handler(event);

      expect(response.success).toBe(true);
      // Verify all scores are in valid 0-1 range
      response.tags!.forEach((tag) => {
        expect(tag.score).toBeGreaterThanOrEqual(0);
        expect(tag.score).toBeLessThanOrEqual(1);
      });
    });

    it('should return tags sorted by hybrid score (highest first)', async () => {
      const event: TagSuggestionEvent = {
        content: 'Machine learning and neural networks are key components of modern AI systems. These technologies enable computers to learn from data and make intelligent decisions without explicit programming.',
        minScore: 0.2,
        maxTags: 5,
      };

      const keywords: KeywordCandidate[] = [
        { text: 'ai', frequency: 0.5 }, // Low frequency
        { text: 'machine', frequency: 1.0 }, // High frequency
        { text: 'learning', frequency: 0.8 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);

      // AI has high semantic score despite low frequency
      mockModel2VecLoader.computeSimilarity.mockReturnValueOnce(0.95); // ai
      mockModel2VecLoader.computeSimilarity.mockReturnValueOnce(0.6); // machine
      mockModel2VecLoader.computeSimilarity.mockReturnValueOnce(0.7); // learning

      const response = await handler(event);

      expect(response.success).toBe(true);
      expect(response.tags!.length).toBeGreaterThan(0);

      // Verify sorted by score descending
      for (let i = 0; i < response.tags!.length - 1; i++) {
        expect(response.tags![i].score).toBeGreaterThanOrEqual(
          response.tags![i + 1].score
        );
      }
    });
  });

  describe('Threshold Filtering', () => {
    it('should filter out tags below minScore threshold (default 0.3)', async () => {
      const event: TagSuggestionEvent = {
        content: 'Test content with low relevance keywords that should be filtered out based on their poor quality scores. This text contains mostly filler words.',
      };


      const keywords: KeywordCandidate[] = [
        { text: 'test', frequency: 0.3 },
        { text: 'content', frequency: 0.2 },
        { text: 'low', frequency: 0.1 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);

      // All semantic scores are low (raw similarity -0.8)
      // After normalization: (-0.8 + 1) / 2 = 0.1
      // Hybrid score = 0.7 * 0.1 + 0.3 * 0.3 = 0.07 + 0.09 = 0.16 < 0.3
      mockModel2VecLoader.computeSimilarity.mockReturnValue(-0.8);

      const response = await handler(event);

      expect(response.success).toBe(true);
      // All tags should be filtered (scores < 0.3)
      expect(response.tags).toEqual([]);
      expect(response.message).toContain('No quality tag suggestions found');
    });

    it('should respect custom minScore threshold', async () => {
      const event: TagSuggestionEvent = {
        content: 'Test content for validating custom minScore threshold behavior with sufficient length to meet the minimum requirements for tag generation.',
        minScore: 0.5, // Higher threshold
        maxTags: 5,
      };

      const keywords: KeywordCandidate[] = [
        { text: 'test', frequency: 0.8 },
        { text: 'content', frequency: 0.6 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);

      // Moderate semantic scores (raw similarity values)
      // test: raw=0.4 → normalized=(0.4+1)/2=0.7 → hybrid=0.7*0.7+0.3*0.8=0.73 ✓ passes 0.5
      // content: raw=-0.2 → normalized=(-0.2+1)/2=0.4 → hybrid=0.7*0.4+0.3*0.6=0.46 ✗ fails 0.5
      mockModel2VecLoader.computeSimilarity.mockReturnValueOnce(0.4); // test
      mockModel2VecLoader.computeSimilarity.mockReturnValueOnce(-0.2); // content

      const response = await handler(event);

      expect(response.success).toBe(true);
      expect(response.tags!.length).toBe(1); // Only 'test' passes 0.5 threshold
      expect(response.tags![0].tag).toBe('test');
    });

    it('should return up to maxTags after filtering (default 5)', async () => {
      const event: TagSuggestionEvent = {
        content: 'JavaScript, TypeScript, React, Vue, Angular, Svelte, Next, and Nuxt are popular frameworks and libraries for modern web development. Each has its own strengths and use cases.',
      };

      const keywords: KeywordCandidate[] = [
        { text: 'javascript', frequency: 1.0 },
        { text: 'typescript', frequency: 0.9 },
        { text: 'react', frequency: 0.8 },
        { text: 'vue', frequency: 0.7 },
        { text: 'angular', frequency: 0.6 },
        { text: 'svelte', frequency: 0.5 },
        { text: 'next', frequency: 0.4 },
        { text: 'nuxt', frequency: 0.3 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);

      // All have high semantic scores
      mockModel2VecLoader.computeSimilarity.mockReturnValue(0.9);

      const response = await handler(event);

      expect(response.success).toBe(true);
      expect(response.tags!.length).toBe(5); // Capped at maxTags
    });
  });

  describe('Edge Cases', () => {
    it('should return error for empty content', async () => {
      const event: TagSuggestionEvent = {
        content: '',
      };

      const response = await handler(event);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Content cannot be empty');
      expect(response.tags).toBeUndefined();
    });

    it('should return error for content < 100 characters', async () => {
      const event: TagSuggestionEvent = {
        content: 'Short text',
      };

      const response = await handler(event);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Content too short');
      expect(response.error).toContain('Add more content or add tags manually');
    });

    it('should handle OpenSearch returning no keywords', async () => {
      const event: TagSuggestionEvent = {
        content: 'a b c d e f g h i j k l m n o p q r s t u v w x y z' + ' test'.repeat(50),
      };

      mockOpenSearchClient.extractKeywords.mockResolvedValue([]);
      mockModel2VecLoader.load.mockResolvedValue({});

      const response = await handler(event);

      expect(response.success).toBe(true);
      expect(response.tags).toEqual([]);
      expect(response.message).toContain('No quality tag suggestions found');
    });

    it('should handle Model2Vec embedding failure gracefully', async () => {
      const event: TagSuggestionEvent = {
        content: 'Test content that causes embedding failure' + ' word'.repeat(30),
      };

      const keywords: KeywordCandidate[] = [
        { text: 'test', frequency: 1.0 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockRejectedValue(new Error('Embedding failed'));

      const response = await handler(event);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.tags).toBeUndefined();
    });

    it('should handle OpenSearch timeout/failure', async () => {
      const event: TagSuggestionEvent = {
        content: 'Test content for timeout scenario' + ' word'.repeat(30),
      };

      mockOpenSearchClient.extractKeywords.mockRejectedValue(
        new Error('Request timeout')
      );

      const response = await handler(event);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should handle whitespace-only content', async () => {
      const event: TagSuggestionEvent = {
        content: '   \n\t   ',
      };

      const response = await handler(event);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Content cannot be empty');
    });
  });

  describe('Multilingual Support', () => {
    it('should handle Japanese content', async () => {
      const event: TagSuggestionEvent = {
        content: 'TypeScriptは静的型付けを持つプログラミング言語です。Reactと組み合わせて使用されることが多いです。' + 'これは追加のテキストです。'.repeat(10),
      };

      const keywords: KeywordCandidate[] = [
        { text: 'typescript', frequency: 1.0 },
        { text: 'プログラミング', frequency: 0.8 },
        { text: '言語', frequency: 0.7 },
        { text: 'react', frequency: 0.6 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);
      mockModel2VecLoader.computeSimilarity.mockReturnValue(0.8);

      const response = await handler(event);

      expect(response.success).toBe(true);
      expect(response.tags!.length).toBeGreaterThan(0);
      // Should include both Japanese and English keywords
      const tags = response.tags!.map((t) => t.tag);
      expect(tags).toContain('typescript');
      expect(tags).toContain('プログラミング');
    });

    it('should handle mixed Japanese-English content', async () => {
      const event: TagSuggestionEvent = {
        content: 'React hooksを使ってstate管理をする。useStateとuseEffectが便利です。さらに詳しい説明を追加します。'.repeat(5),
      };

      const keywords: KeywordCandidate[] = [
        { text: 'react', frequency: 1.0 },
        { text: 'hooks', frequency: 0.9 },
        { text: 'state', frequency: 0.8 },
        { text: '管理', frequency: 0.7 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);
      mockModel2VecLoader.computeSimilarity.mockReturnValue(0.75);

      const response = await handler(event);

      expect(response.success).toBe(true);
      expect(response.tags!.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete within reasonable time', async () => {
      const event: TagSuggestionEvent = {
        content: 'Test content for performance measurement with sufficient length to meet the minimum character requirement for tag suggestion processing and analysis.',
      };

      const keywords: KeywordCandidate[] = [
        { text: 'test', frequency: 1.0 },
        { text: 'content', frequency: 0.8 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);
      mockModel2VecLoader.computeSimilarity.mockReturnValue(0.7);

      const start = Date.now();
      const response = await handler(event);
      const duration = Date.now() - start;

      expect(response.success).toBe(true);
      // In test environment with mocks, should be very fast
      expect(duration).toBeLessThan(100); // 100ms with mocks
    });

    it('should cleanup resources after execution', async () => {
      const event: TagSuggestionEvent = {
        content: 'Test content for resource cleanup verification with additional text to meet minimum length requirements for the tag suggestion algorithm.',
      };

      const keywords: KeywordCandidate[] = [
        { text: 'test', frequency: 1.0 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);
      mockModel2VecLoader.computeSimilarity.mockReturnValue(0.7);

      await handler(event);

      // Verify cleanup methods were called
      expect(mockOpenSearchClient.close).toHaveBeenCalled();
      expect(mockModel2VecLoader.unload).toHaveBeenCalled();
    });
  });

  describe('Response Format', () => {
    it('should return TagSuggestionResponse with correct structure on success', async () => {
      const event: TagSuggestionEvent = {
        content: 'TypeScript programming language with static typing and excellent tooling support for modern web development projects.',
      };

      const keywords: KeywordCandidate[] = [
        { text: 'typescript', frequency: 1.0 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);
      mockModel2VecLoader.computeSimilarity.mockReturnValue(0.8);

      const response = await handler(event);

      expect(response).toMatchObject({
        success: true,
        tags: expect.arrayContaining([
          expect.objectContaining({
            tag: expect.any(String),
            score: expect.any(Number),
          }),
        ]),
      });
      expect(response.error).toBeUndefined();
    });

    it('should return TagSuggestionResponse with error on failure', async () => {
      const event: TagSuggestionEvent = {
        content: '',
      };

      const response = await handler(event);

      expect(response).toMatchObject({
        success: false,
        error: expect.any(String),
      });
      expect(response.tags).toBeUndefined();
    });
  });

  describe('Timeout and Fallback (T045)', () => {
    it('should enforce 3-second timeout for total operation', async () => {
      const event: TagSuggestionEvent = {
        content: 'Test content for timeout validation with sufficient length to meet minimum requirements for tag suggestion processing.',
      };

      // Mock both services to take longer than 3 seconds (4 seconds each)
      // Even in parallel, this will exceed the 3s timeout
      mockOpenSearchClient.extractKeywords.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve([
                  { text: 'test', frequency: 1.0 },
                ]),
              4000
            )
          )
      );

      mockModel2VecLoader.load.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({}), 4000)
          )
      );

      const start = Date.now();
      const response = await handler(event);
      const duration = Date.now() - start;

      expect(response.success).toBe(false);
      expect(response.error).toMatch(/timed? ?out/i); // Match "timeout" or "timed out"
      expect(duration).toBeLessThanOrEqual(3500); // 3s timeout + 500ms buffer
    }, 5000); // Test timeout: 5 seconds to allow for handler timeout

    it('should return frequency-only tags when Model2Vec fails but OpenSearch succeeds', async () => {
      const event: TagSuggestionEvent = {
        content: 'JavaScript and TypeScript are popular programming languages used for web development and application building.',
      };

      const keywords: KeywordCandidate[] = [
        { text: 'javascript', frequency: 1.0 },
        { text: 'typescript', frequency: 0.8 },
        { text: 'programming', frequency: 0.6 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockRejectedValue(
        new Error('Model2Vec loading failed')
      );

      const response = await handler(event);

      expect(response.success).toBe(true);
      expect(response.tags).toBeDefined();
      expect(response.tags!.length).toBeGreaterThan(0);

      // Verify tags are returned with frequency-only scores (normalized)
      expect(response.tags![0].tag).toBe('javascript');
      expect(response.message).toContain('frequency-only');
    });

    it('should fail when OpenSearch fails even if Model2Vec would succeed', async () => {
      const event: TagSuggestionEvent = {
        content: 'Test content for OpenSearch failure scenario with enough text to meet minimum length requirements.',
      };

      mockOpenSearchClient.extractKeywords.mockRejectedValue(
        new Error('OpenSearch connection failed')
      );
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);

      const response = await handler(event);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.tags).toBeUndefined();
    });

    it('should fail when both OpenSearch and Model2Vec fail', async () => {
      const event: TagSuggestionEvent = {
        content: 'Test content for total failure scenario with adequate length to pass validation checks.',
      };

      mockOpenSearchClient.extractKeywords.mockRejectedValue(
        new Error('OpenSearch failed')
      );
      mockModel2VecLoader.load.mockRejectedValue(
        new Error('Model2Vec failed')
      );

      const response = await handler(event);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.tags).toBeUndefined();
    });

    it('should run OpenSearch and Model2Vec in parallel', async () => {
      const event: TagSuggestionEvent = {
        content: 'Performance test content to validate parallel execution of OpenSearch keyword extraction and Model2Vec semantic ranking.',
      };

      const keywords: KeywordCandidate[] = [
        { text: 'test', frequency: 1.0 },
      ];

      let opensearchStartTime = 0;
      let model2vecStartTime = 0;

      mockOpenSearchClient.extractKeywords.mockImplementation(async () => {
        opensearchStartTime = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 100));
        return keywords;
      });

      mockModel2VecLoader.load.mockImplementation(async () => {
        model2vecStartTime = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {};
      });

      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);
      mockModel2VecLoader.computeSimilarity.mockReturnValue(0.8);

      const start = Date.now();
      await handler(event);
      const duration = Date.now() - start;

      // If parallel, duration should be ~100ms (max of both)
      // If sequential, duration would be ~200ms (sum of both)
      expect(duration).toBeLessThan(150); // Parallel execution

      // Both should start at roughly the same time (within 50ms)
      expect(Math.abs(opensearchStartTime - model2vecStartTime)).toBeLessThan(50);
    });

    it('should include component latency metrics in response', async () => {
      const event: TagSuggestionEvent = {
        content: 'Metrics test content with adequate length for testing component-level latency tracking and monitoring.',
      };

      const keywords: KeywordCandidate[] = [
        { text: 'test', frequency: 1.0 },
      ];

      mockOpenSearchClient.extractKeywords.mockResolvedValue(keywords);
      mockModel2VecLoader.load.mockResolvedValue({});
      mockModel2VecLoader.embed.mockResolvedValue([0.5, 0.5]);
      mockModel2VecLoader.computeSimilarity.mockReturnValue(0.8);

      const response = await handler(event);

      expect(response.success).toBe(true);
      expect(response.metrics).toBeDefined();
      expect(response.metrics!.opensearchLatencyMs).toBeDefined();
      expect(response.metrics!.model2vecLatencyMs).toBeDefined();
      expect(response.metrics!.totalLatencyMs).toBeDefined();

      // Total should be >= max(opensearch, model2vec) for parallel execution
      const maxComponent = Math.max(
        response.metrics!.opensearchLatencyMs!,
        response.metrics!.model2vecLatencyMs!
      );
      expect(response.metrics!.totalLatencyMs).toBeGreaterThanOrEqual(maxComponent);
    });

    it('should provide retry guidance only when both components fail', async () => {
      const event: TagSuggestionEvent = {
        content: 'Test content for retry policy validation with sufficient length to meet minimum character requirements.',
      };

      mockOpenSearchClient.extractKeywords.mockRejectedValue(
        new Error('OpenSearch service unavailable')
      );
      mockModel2VecLoader.load.mockRejectedValue(
        new Error('Model2Vec service unavailable')
      );

      const response = await handler(event);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      // Message should indicate user can retry manually
      expect(response.message).toContain('retry');
    });
  });
});
