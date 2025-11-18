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
  /** Maximum total operation timeout (milliseconds) - FR-014, SC-005 */
  TIMEOUT_MS: 3000,
} as const;

/**
 * Helper to create a promise that rejects after a timeout
 */
function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

/**
 * Main Lambda handler for tag suggestion
 *
 * Implements hybrid ranking algorithm with parallel execution and graceful fallback:
 * 1. Extract keywords (OpenSearch) and load Model2Vec in parallel (T045)
 * 2. Handle partial failures: if one succeeds, use available component (T045)
 * 3. Enforce 3-second timeout for total operation (T045, FR-014, SC-005)
 * 4. Compute hybrid scores when both succeed, frequency-only if Model2Vec fails
 * 5. Filter by threshold and return top N tags
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

    // T045: Run OpenSearch and Model2Vec in parallel with 3-second timeout
    openSearchClient = createOpenSearchClient();
    modelLoader = createModel2VecLoader();

    const opensearchStart = Date.now();
    const model2vecStart = Date.now();

    // Execute both operations in parallel with timeout
    const parallelOperation = Promise.allSettled([
      openSearchClient.extractKeywords(content).catch((error) => {
        if (error instanceof OpenSearchError) {
          throw new Error(
            `OpenSearch keyword extraction failed: ${error.message}`
          );
        }
        throw error;
      }),
      modelLoader.load().catch((error) => {
        if (error instanceof ModelLoadError) {
          throw new Error(`Model2Vec loading failed: ${error.message}`);
        }
        throw error;
      }),
    ]);

    // Race against timeout - if timeout wins, throw error
    const raceResult = await Promise.race([
      parallelOperation.then((result) => ({ result, timedOut: false })),
      createTimeoutPromise(HYBRID_CONFIG.TIMEOUT_MS).catch((error) => {
        throw error; // Re-throw timeout error to be caught by outer try-catch
      }),
    ]);

    const [opensearchResult, model2vecResult] = raceResult.result;

    metrics.opensearchLatencyMs = Date.now() - opensearchStart;
    metrics.model2vecLatencyMs = Date.now() - model2vecStart;

    // T045: Handle partial failures
    let keywords: KeywordCandidate[] = [];
    let model2vecLoaded = false;

    // Check OpenSearch result
    if (opensearchResult.status === 'fulfilled') {
      keywords = opensearchResult.value;
    } else {
      // OpenSearch failed - cannot continue without keywords
      const opensearchError =
        opensearchResult.reason instanceof Error
          ? opensearchResult.reason.message
          : 'Unknown error';

      // If both failed, provide retry guidance
      if (model2vecResult.status === 'rejected') {
        return {
          success: false,
          error: `Tag suggestion services are currently unavailable. Please try again or add tags manually. (OpenSearch: ${opensearchError})`,
          message:
            'Both components failed. You can retry by clicking "Suggest Tags" again.',
          metrics: {
            ...metrics,
            totalLatencyMs: Date.now() - startTime,
          },
        };
      }

      // Only OpenSearch failed
      return {
        success: false,
        error: `OpenSearch keyword extraction failed: ${opensearchError}`,
        metrics: {
          ...metrics,
          totalLatencyMs: Date.now() - startTime,
        },
      };
    }

    // Check Model2Vec result
    if (model2vecResult.status === 'fulfilled') {
      model2vecLoaded = true;
    } else {
      console.warn(
        `Model2Vec failed, falling back to frequency-only scoring: ${
          model2vecResult.reason instanceof Error
            ? model2vecResult.reason.message
            : 'Unknown error'
        }`
      );
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

    // T045: Compute scores based on available components
    let tagSuggestions: TagSuggestion[];

    if (model2vecLoaded) {
      // Hybrid scoring (both components succeeded)
      tagSuggestions = await computeHybridScores(
        keywords,
        content,
        modelLoader!,
        scoreThreshold
      );
    } else {
      // Frequency-only scoring (Model2Vec failed, OpenSearch succeeded)
      tagSuggestions = computeFrequencyOnlyScores(keywords, scoreThreshold);
    }

    // Sort by score descending and limit to maxTags
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

    const scoringMode = model2vecLoaded ? 'hybrid' : 'frequency-only';
    return {
      success: true,
      tags: topTags,
      message: `Generated ${topTags.length} tag suggestion${topTags.length !== 1 ? 's' : ''} using ${scoringMode} scoring`,
      metrics,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    // Check if it's a timeout error
    const isTimeout = errorMessage.includes('timeout');

    return {
      success: false,
      error: errorMessage,
      message: isTimeout
        ? 'Tag suggestion timed out. Please try again or add tags manually.'
        : undefined,
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
 * Compute hybrid scores using both OpenSearch frequency and Model2Vec semantics
 *
 * @param keywords - Keywords from OpenSearch with frequency scores
 * @param content - Article content for embedding
 * @param modelLoader - Loaded Model2Vec instance
 * @param scoreThreshold - Minimum score threshold
 * @returns Array of tag suggestions with hybrid scores
 */
async function computeHybridScores(
  keywords: KeywordCandidate[],
  content: string,
  modelLoader: ReturnType<typeof createModel2VecLoader>,
  scoreThreshold: number
): Promise<TagSuggestion[]> {
  const tagSuggestions: TagSuggestion[] = [];

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

  // Compute hybrid scores
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

  return tagSuggestions;
}

/**
 * Compute frequency-only scores when Model2Vec is unavailable (T045 fallback)
 *
 * @param keywords - Keywords from OpenSearch with frequency scores
 * @param scoreThreshold - Minimum score threshold
 * @returns Array of tag suggestions with frequency-only scores
 */
function computeFrequencyOnlyScores(
  keywords: KeywordCandidate[],
  scoreThreshold: number
): TagSuggestion[] {
  const tagSuggestions: TagSuggestion[] = [];

  for (const keyword of keywords) {
    // Use frequency as the score directly
    const score = keyword.frequency;

    // Filter by threshold
    if (score >= scoreThreshold) {
      tagSuggestions.push({
        tag: keyword.text,
        score,
      });
    }
  }

  return tagSuggestions;
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
