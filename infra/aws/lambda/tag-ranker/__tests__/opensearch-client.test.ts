/**
 * Tests for OpenSearch Keyword Extraction Client
 *
 * Requirements Coverage:
 * - FR-003: Tag suggestions from title + body content
 * - SC-005: OpenSearch extraction ≤1s component target
 * - Session 2025-11-14: Title + body concatenated as input
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OpenSearchClient,
  KeywordCandidate,
  OpenSearchConfig,
  OpenSearchError
} from '../opensearch-client';

describe('OpenSearchClient', () => {
  let client: OpenSearchClient;
  let mockConfig: OpenSearchConfig;

  beforeEach(() => {
    mockConfig = {
      endpoint: 'https://test-opensearch.example.com',
      region: 'ap-northeast-1',
      indexName: 'article-keywords',
      maxKeywords: 20, // Extract more candidates than final 5 for ranking
    };
    client = new OpenSearchClient(mockConfig);
  });

  describe('constructor', () => {
    it('should create client with valid config', () => {
      expect(client).toBeInstanceOf(OpenSearchClient);
    });

    it('should throw error if endpoint is missing', () => {
      expect(() => new OpenSearchClient({ ...mockConfig, endpoint: '' }))
        .toThrow('OpenSearch endpoint is required');
    });

    it('should throw error if region is missing', () => {
      expect(() => new OpenSearchClient({ ...mockConfig, region: '' }))
        .toThrow('AWS region is required');
    });

    it('should use default maxKeywords of 20 if not provided', () => {
      const defaultClient = new OpenSearchClient({
        endpoint: mockConfig.endpoint,
        region: mockConfig.region,
        indexName: mockConfig.indexName,
      });
      expect(defaultClient).toBeInstanceOf(OpenSearchClient);
    });
  });

  describe('extractKeywords', () => {
    describe('input validation', () => {
      it('should reject empty content', async () => {
        await expect(client.extractKeywords('')).rejects.toThrow(
          'Content cannot be empty'
        );
      });

      it('should reject content with only whitespace', async () => {
        await expect(client.extractKeywords('   \n\t  ')).rejects.toThrow(
          'Content cannot be empty'
        );
      });

      it('should accept content with minimum 1 character after trim', async () => {
        const mockExtract = vi.spyOn(client as any, '_performExtraction');
        mockExtract.mockResolvedValue([]);

        await client.extractKeywords('a');
        expect(mockExtract).toHaveBeenCalledWith('a');
      });
    });

    describe('keyword extraction', () => {
      it('should extract keywords from Japanese content', async () => {
        const content = 'Next.jsとTypeScriptで構築するブログシステム。モダンなウェブ開発技術を活用。';

        const result = await client.extractKeywords(content);

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThanOrEqual(20);

        // Verify structure of returned keywords
        result.forEach((keyword: KeywordCandidate) => {
          expect(keyword).toHaveProperty('text');
          expect(keyword).toHaveProperty('frequency');
          expect(keyword.text).toBeTruthy();
          expect(keyword.frequency).toBeGreaterThan(0);
          expect(keyword.frequency).toBeLessThanOrEqual(1);
        });
      });

      it('should extract keywords from English content', async () => {
        const content = 'Building a modern blog platform with Next.js and TypeScript. Serverless architecture with AWS Lambda.';

        const result = await client.extractKeywords(content);

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);

        // Should extract technical terms
        const keywords = result.map((k: KeywordCandidate) => k.text.toLowerCase());
        expect(keywords.some((k: string) =>
          k.includes('next') || k.includes('typescript') || k.includes('lambda') || k.includes('aws')
        )).toBe(true);
      });

      it('should extract keywords from mixed Japanese-English content', async () => {
        const content = 'AWS Lambdaを使った tag suggestion システムの実装。OpenSearchとModel2Vecで hybrid scoring を実現。';

        const result = await client.extractKeywords(content);

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);

        // Should handle mixed language
        const hasEnglish = result.some((k: KeywordCandidate) => /[a-zA-Z]/.test(k.text));
        const hasJapanese = result.some((k: KeywordCandidate) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(k.text));
        expect(hasEnglish || hasJapanese).toBe(true);
      });

      it('should return keywords sorted by frequency (highest first)', async () => {
        const content = 'TypeScript TypeScript TypeScript Lambda Lambda AWS';

        const result = await client.extractKeywords(content);

        expect(result.length).toBeGreaterThan(0);

        // Verify descending frequency order
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].frequency).toBeGreaterThanOrEqual(result[i + 1].frequency);
        }
      });

      it('should limit results to maxKeywords', async () => {
        const content = Array(50).fill('keyword').map((w, i) => `${w}${i}`).join(' ');

        const result = await client.extractKeywords(content);

        expect(result.length).toBeLessThanOrEqual(mockConfig.maxKeywords!);
      });

      it('should normalize keyword scores to 0-1 range', async () => {
        const content = 'Lambda Lambda AWS AWS TypeScript Next.js';

        const result = await client.extractKeywords(content);

        result.forEach((keyword: KeywordCandidate) => {
          expect(keyword.frequency).toBeGreaterThanOrEqual(0);
          expect(keyword.frequency).toBeLessThanOrEqual(1);
        });
      });
    });

    describe('performance', () => {
      it('should complete extraction within 1 second', async () => {
        const content = 'Next.js TypeScript React AWS Lambda OpenSearch Model2Vec semantic ranking hybrid scoring tag suggestion system';

        const startTime = Date.now();
        await client.extractKeywords(content);
        const duration = Date.now() - startTime;

        // SC-005 requirement: OpenSearch ≤1s
        expect(duration).toBeLessThan(1000);
      }, 1500); // Test timeout slightly above requirement

      it('should handle large content efficiently', async () => {
        // Simulate a 5000-word article (~30KB)
        const content = Array(5000)
          .fill('word')
          .map((w, i) => `${w}${i % 100}`)
          .join(' ');

        const startTime = Date.now();
        await client.extractKeywords(content);
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(1000);
      }, 1500);
    });

    describe('error handling', () => {
      it('should throw OpenSearchError on connection failure', async () => {
        const badClient = new OpenSearchClient({
          ...mockConfig,
          endpoint: 'https://invalid-endpoint.example.com',
        });

        await expect(badClient.extractKeywords('test content')).rejects.toThrow(OpenSearchError);
      });

      it('should throw OpenSearchError on timeout', async () => {
        // This would require mocking the OpenSearch call with a delay
        // For now, we define the contract
        const slowClient = new OpenSearchClient({
          ...mockConfig,
          timeout: 1, // 1ms timeout
        });

        await expect(slowClient.extractKeywords('test')).rejects.toThrow(OpenSearchError);
      });

      it('should throw OpenSearchError on invalid index', async () => {
        const badIndexClient = new OpenSearchClient({
          ...mockConfig,
          indexName: 'non-existent-index',
        });

        await expect(badIndexClient.extractKeywords('test')).rejects.toThrow(OpenSearchError);
      });

      it('should include error details in OpenSearchError', async () => {
        try {
          const badClient = new OpenSearchClient({
            ...mockConfig,
            endpoint: 'https://invalid.example.com',
          });
          await badClient.extractKeywords('test');
          fail('Should have thrown OpenSearchError');
        } catch (error) {
          expect(error).toBeInstanceOf(OpenSearchError);
          expect((error as OpenSearchError).message).toBeTruthy();
          expect((error as OpenSearchError).statusCode).toBeDefined();
        }
      });
    });

    describe('edge cases', () => {
      it('should handle content with only stop words', async () => {
        const content = 'the a an and or but';

        const result = await client.extractKeywords(content);

        // Should return empty array or filter out stop words
        expect(result).toBeInstanceOf(Array);
      });

      it('should handle content with special characters', async () => {
        const content = 'Next.js + TypeScript = ❤️ Modern Web Development!';

        const result = await client.extractKeywords(content);

        expect(result).toBeInstanceOf(Array);
        // Should extract meaningful keywords despite special chars
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle content with URLs and code', async () => {
        const content = `
          Check out https://nextjs.org for documentation.
          Install with: npm install next@latest
          const handler = async () => {}
        `;

        const result = await client.extractKeywords(content);

        expect(result).toBeInstanceOf(Array);
      });

      it('should deduplicate keywords with different cases', async () => {
        const content = 'TypeScript typescript TYPESCRIPT Typescript';

        const result = await client.extractKeywords(content);

        // Should have only one entry for "typescript" (case-insensitive)
        const typescriptEntries = result.filter((k: KeywordCandidate) =>
          k.text.toLowerCase() === 'typescript'
        );
        expect(typescriptEntries.length).toBe(1);
      });
    });
  });

  describe('close', () => {
    it('should cleanup resources when closed', async () => {
      await client.close();

      // After close, subsequent calls should fail gracefully
      await expect(client.extractKeywords('test')).rejects.toThrow();
    });
  });
});
