/**
 * OpenSearch Keyword Extraction Client
 *
 * Requirements:
 * - FR-003: Extract keywords from combined title + body content
 * - SC-005: Target latency ≤1s for keyword extraction
 * - Session 2025-11-14 clarifications: Handle multilingual content (Japanese, English, mixed)
 *
 * Architecture:
 * - Called by Lambda handler.ts (T044)
 * - Returns keyword candidates with frequency scores
 * - Handler applies Model2Vec semantic ranking (70% semantic + 30% frequency)
 *
 * @module opensearch-client
 */

import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

/**
 * Configuration for OpenSearch client
 */
export interface OpenSearchConfig {
  /** OpenSearch endpoint URL */
  endpoint: string;
  /** AWS region for Sigv4 signing */
  region: string;
  /** Index name for keyword storage */
  indexName: string;
  /** Maximum number of keyword candidates to return (default: 20) */
  maxKeywords?: number;
  /** Request timeout in milliseconds (default: 900ms to meet 1s SLA) */
  timeout?: number;
}

/**
 * Keyword candidate with frequency score
 */
export interface KeywordCandidate {
  /** Keyword text (normalized) */
  text: string;
  /** Frequency score normalized to 0-1 range (1 = highest frequency) */
  frequency: number;
}

/**
 * Custom error for OpenSearch operations
 */
export class OpenSearchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'OpenSearchError';
    Object.setPrototypeOf(this, OpenSearchError.prototype);
  }
}

/**
 * OpenSearch client for keyword extraction
 *
 * Uses OpenSearch k-NN for extracting relevant keywords from article content.
 * Keywords are ranked by frequency and normalized to 0-1 scale.
 */
export class OpenSearchClient {
  private readonly client: Client;
  private readonly config: Required<OpenSearchConfig>;
  private closed = false;

  constructor(config: OpenSearchConfig) {
    // Validate required config
    if (!config.endpoint || config.endpoint.trim() === '') {
      throw new Error('OpenSearch endpoint is required');
    }
    if (!config.region || config.region.trim() === '') {
      throw new Error('AWS region is required');
    }
    if (!config.indexName || config.indexName.trim() === '') {
      throw new Error('Index name is required');
    }

    // Set defaults
    this.config = {
      endpoint: config.endpoint,
      region: config.region,
      indexName: config.indexName,
      maxKeywords: config.maxKeywords ?? 20,
      timeout: config.timeout ?? 900, // 900ms default (buffer for 1s SLA)
    };

    // Initialize OpenSearch client with AWS Sigv4 signing
    this.client = new Client({
      ...AwsSigv4Signer({
        region: this.config.region,
        service: 'es', // OpenSearch service
      }),
      node: this.config.endpoint,
      requestTimeout: this.config.timeout,
    });
  }

  /**
   * Extract keywords from article content
   *
   * @param content - Combined title + body content
   * @returns Array of keyword candidates sorted by frequency (highest first)
   * @throws {OpenSearchError} On extraction failure
   *
   * Requirements:
   * - SC-005: Complete within 1s
   * - FR-003: Handle multilingual content (Japanese, English, mixed)
   * - Session 2025-11-14: Input is pre-concatenated title + body
   */
  async extractKeywords(content: string): Promise<KeywordCandidate[]> {
    // Validate client state
    if (this.closed) {
      throw new OpenSearchError('Client has been closed');
    }

    // Validate input
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new Error('Content cannot be empty');
    }

    try {
      return await this._performExtraction(trimmedContent);
    } catch (error) {
      if (error instanceof OpenSearchError) {
        throw error;
      }

      // Wrap unexpected errors
      throw new OpenSearchError(
        'Keyword extraction failed',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Internal method to perform keyword extraction
   *
   * Uses OpenSearch analyze API with keyword tokenizer and frequency aggregation.
   * Implements multilingual support through language-agnostic tokenization.
   *
   * @private
   */
  private async _performExtraction(content: string): Promise<KeywordCandidate[]> {
    try {
      // Use OpenSearch _analyze API for tokenization and keyword extraction
      const response = await this.client.indices.analyze({
        index: this.config.indexName,
        body: {
          text: content,
          analyzer: 'standard', // Standard analyzer handles multilingual content
          filter: [
            'lowercase', // Normalize case
            'stop', // Remove stop words
            {
              type: 'length',
              min: 2, // Minimum 2 characters
              max: 50, // Maximum 50 characters for keywords
            },
          ],
        },
      });

      // Extract tokens from response
      const tokens = response.body.tokens || [];

      // Count frequency of each token
      const frequencyMap = new Map<string, number>();
      let maxFrequency = 0;

      tokens.forEach((token: { token: string }) => {
        const normalized = token.token.toLowerCase().trim();

        // Skip if too short or contains only special characters
        if (normalized.length < 2 || !/[a-zA-Z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(normalized)) {
          return;
        }

        const count = (frequencyMap.get(normalized) || 0) + 1;
        frequencyMap.set(normalized, count);
        maxFrequency = Math.max(maxFrequency, count);
      });

      // Convert to KeywordCandidate array with normalized scores
      const keywords: KeywordCandidate[] = Array.from(frequencyMap.entries())
        .map(([text, count]) => ({
          text,
          frequency: maxFrequency > 0 ? count / maxFrequency : 0, // Normalize to 0-1
        }))
        .sort((a, b) => b.frequency - a.frequency) // Sort by frequency descending
        .slice(0, this.config.maxKeywords); // Limit to maxKeywords

      return keywords;
    } catch (error: any) {
      // Handle OpenSearch-specific errors
      const statusCode = error?.statusCode || error?.meta?.statusCode;
      const message = error?.message || 'Unknown OpenSearch error';

      throw new OpenSearchError(
        `OpenSearch extraction failed: ${message}`,
        statusCode,
        error
      );
    }
  }

  /**
   * Close the OpenSearch client and cleanup resources
   *
   * After calling close(), the client cannot be reused.
   */
  async close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      await this.client.close();
    }
  }
}

/**
 * Factory function to create OpenSearch client with environment config
 *
 * Reads configuration from environment variables:
 * - OPENSEARCH_ENDPOINT
 * - AWS_REGION (or defaults to ap-northeast-1)
 * - OPENSEARCH_INDEX_NAME (or defaults to 'article-keywords')
 * - OPENSEARCH_MAX_KEYWORDS (or defaults to 20)
 */
export function createOpenSearchClient(overrides?: Partial<OpenSearchConfig>): OpenSearchClient {
  const config: OpenSearchConfig = {
    endpoint: process.env.OPENSEARCH_ENDPOINT || '',
    region: process.env.AWS_REGION || 'ap-northeast-1',
    indexName: process.env.OPENSEARCH_INDEX_NAME || 'article-keywords',
    maxKeywords: process.env.OPENSEARCH_MAX_KEYWORDS
      ? parseInt(process.env.OPENSEARCH_MAX_KEYWORDS, 10)
      : 20,
    ...overrides,
  };

  return new OpenSearchClient(config);
}
