/**
 * Tag Ranker Lambda Handler
 *
 * Requirements:
 * - FR-003: Generate up to 5 tag suggestions with hybrid scoring
 * - FR-003: Hybrid algorithm: 70% semantic (Model2Vec) + 30% frequency (OpenSearch)
 * - FR-003: Minimum combined score threshold ≥0.3 on 0-1 scale
 * - FR-003: Content minimum length: 100 characters
 * - SC-005: Total latency ≤3s (OpenSearch ≤1s, Model2Vec ≤1.5s, network ≤0.5s)
 * - Session 2025-11-14: Japanese-focused multilingual Model2Vec embeddings
 *
 * Architecture:
 * - Invoked by Next.js API route /api/articles/[articleId]/tags/suggest
 * - Combines OpenSearch keyword extraction with Model2Vec semantic ranking
 * - Returns ranked tag suggestions sorted by hybrid score (highest first)
 *
 * @module handler
 */

import {
  createOpenSearchClient,
  KeywordCandidate,
  OpenSearchError,
} from './opensearch-client';
import { createModel2VecLoader, ModelLoadError } from './model-loader';

/**
 * Lambda event for tag suggestion
 */
export interface TagSuggestionEvent {
  /** Combined article title + body content */
  content: string;
  /** Minimum combined score threshold (default: 0.3) */
  minScore?: number;
  /** Maximum number of tags to return (default: 5) */
  maxTags?: number;
}

/**
 * Suggested tag with hybrid score
 */
export interface TagSuggestion {
  /** Tag text (normalized keyword) */
  tag: string;
  /** Combined hybrid score (0-1 scale) */
  score: number;
}

/**
 * Lambda response for tag suggestions
 */
export interface TagSuggestionResponse {
  /** Operation success status */
  success: boolean;
  /** Array of tag suggestions (sorted by score descending) */
  tags?: TagSuggestion[];
  /** Human-readable message */
  message?: string;
  /** Error message if success=false */
  error?: string;
  /** Component latency metrics for debugging */
  metrics?: {
    opensearchLatencyMs?: number;
    model2vecLatencyMs?: number;
    totalLatencyMs?: number;
  };
}

/**
 * Hybrid scoring configuration
 */
const HYBRID_CONFIG = {
  /** Semantic score weight (Model2Vec) */
  SEMANTIC_WEIGHT: 0.7,
  /** Frequency score weight (OpenSearch) */
  FREQUENCY_WEIGHT: 0.3,
  /** Default minimum score threshold */
  DEFAULT_MIN_SCORE: 0.3,
  /** Default maximum tags to return */
  DEFAULT_MAX_TAGS: 5,
  /** Minimum content length (characters) */
  MIN_CONTENT_LENGTH: 100,
} as const;

/**
 * Main Lambda handler for tag suggestion
 *
 * Implements hybrid ranking algorithm:
 * 1. Extract keywords with frequency scores from OpenSearch
 * 2. Generate semantic embeddings using Model2Vec
 * 3. Compute hybrid scores: 70% semantic + 30% frequency
 * 4. Filter by threshold and return top N tags
 *
 * @param event - Tag suggestion event with content and parameters
 * @returns Tag suggestion response with ranked tags or error
 */
export async function handler(
  event: TagSuggestionEvent
): Promise<TagSuggestionResponse> {
  const startTime = Date.now();
  const metrics: TagSuggestionResponse['metrics'] = {};

  // Initialize clients
  let openSearchClient: ReturnType<typeof createOpenSearchClient> | null = null;
  let modelLoader: ReturnType<typeof createModel2VecLoader> | null = null;

  try {
    // Validate input
    const validationError = validateInput(event);
    if (validationError) {
      return {
        success: false,
        error: validationError,
      };
    }

    const { content, minScore, maxTags } = event;
    const scoreThreshold = minScore ?? HYBRID_CONFIG.DEFAULT_MIN_SCORE;
    const tagLimit = maxTags ?? HYBRID_CONFIG.DEFAULT_MAX_TAGS;

    // Step 1: Extract keywords from OpenSearch
    const opensearchStart = Date.now();
    openSearchClient = createOpenSearchClient();

    let keywords: KeywordCandidate[];
    try {
      keywords = await openSearchClient.extractKeywords(content);
    } catch (error) {
      if (error instanceof OpenSearchError) {
        throw new Error(
          `OpenSearch keyword extraction failed: ${error.message}`
        );
      }
      throw error;
    } finally {
      metrics.opensearchLatencyMs = Date.now() - opensearchStart;
    }

    // Handle no keywords found
    if (keywords.length === 0) {
      return {
        success: true,
        tags: [],
        message:
          'No quality tag suggestions found. Add tags manually or try adding more descriptive content.',
        metrics: {
          ...metrics,
          totalLatencyMs: Date.now() - startTime,
        },
      };
    }

    // Step 2: Load Model2Vec and generate embeddings
    const model2vecStart = Date.now();
    modelLoader = createModel2VecLoader();

    try {
      await modelLoader.load();
    } catch (error) {
      if (error instanceof ModelLoadError) {
        throw new Error(`Model2Vec loading failed: ${error.message}`);
      }
      throw error;
    }

    // Generate content embedding
    const contentEmbedding = await modelLoader.embed(content);

    // Generate keyword embeddings and compute semantic scores
    const semanticScores = new Map<string, number>();

    for (const keyword of keywords) {
      try {
        const keywordEmbedding = await modelLoader.embed(keyword.text);
        const rawSimilarity = modelLoader.computeSimilarity(
          contentEmbedding,
          keywordEmbedding
        );

        // Normalize similarity from [-1, 1] to [0, 1]
        const normalizedSimilarity = (rawSimilarity + 1) / 2;
        semanticScores.set(keyword.text, normalizedSimilarity);
      } catch (error) {
        // Skip keywords that fail embedding
        console.warn(
          `Failed to embed keyword "${keyword.text}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        continue;
      }
    }

    metrics.model2vecLatencyMs = Date.now() - model2vecStart;

    // Step 3: Compute hybrid scores
    const tagSuggestions: TagSuggestion[] = [];

    for (const keyword of keywords) {
      const semantic = semanticScores.get(keyword.text);
      if (semantic === undefined) {
        // Skip if embedding failed
        continue;
      }

      const frequency = keyword.frequency;

      // Hybrid score = 70% semantic + 30% frequency
      const hybridScore =
        HYBRID_CONFIG.SEMANTIC_WEIGHT * semantic +
        HYBRID_CONFIG.FREQUENCY_WEIGHT * frequency;

      // Filter by threshold
      if (hybridScore >= scoreThreshold) {
        tagSuggestions.push({
          tag: keyword.text,
          score: hybridScore,
        });
      }
    }

    // Step 4: Sort by score descending and limit to maxTags
    tagSuggestions.sort((a, b) => b.score - a.score);
    const topTags = tagSuggestions.slice(0, tagLimit);

    metrics.totalLatencyMs = Date.now() - startTime;

    // Return results
    if (topTags.length === 0) {
      return {
        success: true,
        tags: [],
        message:
          'No quality tag suggestions found. Add tags manually or try adding more descriptive content.',
        metrics,
      };
    }

    return {
      success: true,
      tags: topTags,
      message: `Generated ${topTags.length} tag suggestion${topTags.length !== 1 ? 's' : ''}`,
      metrics,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      success: false,
      error: errorMessage,
      metrics: {
        ...metrics,
        totalLatencyMs: Date.now() - startTime,
      },
    };
  } finally {
    // Cleanup resources
    try {
      if (openSearchClient) {
        await openSearchClient.close();
      }
    } catch (error) {
      console.warn('Failed to close OpenSearch client:', error);
    }

    try {
      if (modelLoader) {
        await modelLoader.unload();
      }
    } catch (error) {
      console.warn('Failed to unload Model2Vec:', error);
    }
  }
}

/**
 * Validate input event
 *
 * @param event - Tag suggestion event
 * @returns Error message if invalid, null if valid
 */
function validateInput(event: TagSuggestionEvent): string | null {
  // Validate content exists
  if (!event.content) {
    return 'Content cannot be empty';
  }

  // Validate content is not whitespace-only
  const trimmedContent = event.content.trim();
  if (trimmedContent.length === 0) {
    return 'Content cannot be empty';
  }

  // Validate minimum content length
  if (trimmedContent.length < HYBRID_CONFIG.MIN_CONTENT_LENGTH) {
    return `Content too short for tag suggestions. Add more content or add tags manually. (Minimum ${HYBRID_CONFIG.MIN_CONTENT_LENGTH} characters required)`;
  }

  // Validate minScore if provided
  if (
    event.minScore !== undefined &&
    (event.minScore < 0 || event.minScore > 1)
  ) {
    return 'minScore must be between 0 and 1';
  }

  // Validate maxTags if provided
  if (event.maxTags !== undefined && event.maxTags < 1) {
    return 'maxTags must be at least 1';
  }

  return null;
}

/**
 * AWS Lambda handler wrapper for API Gateway integration
 *
 * Converts API Gateway event to TagSuggestionEvent and formats response
 */
export async function lambdaHandler(
  event: any,
  context: any
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  try {
    // Parse request body
    const body =
      typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // Call main handler
    const response = await handler(body);

    // Return API Gateway response
    return {
      statusCode: response.success ? 200 : 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Lambda handler error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
    };
  }
}
