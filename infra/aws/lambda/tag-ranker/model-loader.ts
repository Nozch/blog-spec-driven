/**
 * Model2Vec Model Loader for Lambda
 *
 * Requirements:
 * - research.md:67: Model2Vec distilled from all-MiniLM-L6-v2
 * - research.md:67: Model size ~8-30MB for Lambda deployment
 * - research.md:74-79: Cold start 500-800ms, inference 5-20ms
 * - Session 2025-11-14: Japanese-focused multilingual embeddings
 *
 * This loader provides efficient loading and caching of the Model2Vec model
 * for semantic embedding generation in the Lambda environment.
 *
 * @module model-loader
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Configuration for Model2Vec loader
 */
export interface Model2VecConfig {
  /** Path to model directory containing model2vec.bin and vocab.txt */
  modelPath: string;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTTL?: number;
}

/**
 * Model metadata information
 */
export interface ModelMetadata {
  /** Model name */
  name: string;
  /** Model version */
  version: string;
  /** Base model this was distilled from */
  baseModel: string;
  /** Model file size in bytes */
  size: number;
  /** Embedding dimensions */
  dimensions: number;
  /** Supported language codes */
  languages: string[];
  /** Creation date */
  createdAt: string;
}

/**
 * Loaded model instance
 */
export interface Model2VecModel {
  /** Word to vector mappings */
  wordVectors: Map<string, number[]>;
  /** Vocabulary list */
  vocabulary: string[];
  /** Embedding dimension */
  dimension: number;
}

/**
 * Custom error for model loading failures
 */
export class ModelLoadError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ModelLoadError';
    Object.setPrototypeOf(this, ModelLoadError.prototype);
  }
}

/**
 * Model2Vec Loader
 *
 * Provides efficient loading, caching, and inference for Model2Vec embeddings.
 * Optimized for AWS Lambda with cold start < 1s and inference < 50ms.
 */
export class Model2VecLoader {
  private readonly config: Required<Model2VecConfig>;
  private cachedModel: Model2VecModel | null = null;
  private cacheTimestamp: number = 0;
  private metadata: ModelMetadata | null = null;

  constructor(config: Model2VecConfig) {
    if (!config.modelPath || config.modelPath.trim() === '') {
      throw new Error('Model path is required');
    }

    this.config = {
      modelPath: config.modelPath,
      cacheTTL: config.cacheTTL ?? 3600000, // 1 hour default
    };
  }

  /**
   * Get model metadata
   *
   * @returns Model metadata including size, dimensions, languages
   * @throws {ModelLoadError} If metadata file is missing or invalid
   */
  async getMetadata(): Promise<ModelMetadata> {
    if (this.metadata) {
      return this.metadata;
    }

    const metadataPath = join(this.config.modelPath, 'metadata.json');

    if (!existsSync(metadataPath)) {
      throw new ModelLoadError(`Metadata file not found at ${metadataPath}`);
    }

    try {
      const metadataContent = readFileSync(metadataPath, 'utf-8');
      this.metadata = JSON.parse(metadataContent);

      if (!this.metadata) {
        throw new Error('Invalid metadata format');
      }

      return this.metadata;
    } catch (error) {
      throw new ModelLoadError(
        'Failed to load model metadata',
        error as Error
      );
    }
  }

  /**
   * Load model into memory
   *
   * Uses caching to avoid reloading on subsequent calls.
   * Cold start: ~500-800ms, Cached: <10ms
   *
   * @returns Loaded model instance
   * @throws {ModelLoadError} If model files are missing or corrupted
   */
  async load(): Promise<Model2VecModel> {
    // Check cache
    const now = Date.now();
    if (
      this.cachedModel &&
      now - this.cacheTimestamp < this.config.cacheTTL
    ) {
      return this.cachedModel;
    }

    // Load from disk
    const modelPath = join(this.config.modelPath, 'model2vec.bin');
    const vocabPath = join(this.config.modelPath, 'vocab.txt');

    if (!existsSync(modelPath)) {
      throw new ModelLoadError(`Model file not found at ${modelPath}`);
    }

    if (!existsSync(vocabPath)) {
      throw new ModelLoadError(`Vocabulary file not found at ${vocabPath}`);
    }

    try {
      // Load vocabulary
      const vocabContent = readFileSync(vocabPath, 'utf-8');
      const vocabulary = vocabContent
        .split('\n')
        .filter((line) => line.trim().length > 0);

      // Load model vectors (simplified binary format)
      // In production, this would parse the actual Model2Vec binary format
      const modelData = readFileSync(modelPath);

      // Parse model format: [dimension:4bytes][numVectors:4bytes][vectors...]
      const dimension = modelData.readInt32LE(0);
      const numVectors = modelData.readInt32LE(4);

      const wordVectors = new Map<string, number[]>();

      let offset = 8;
      for (let i = 0; i < Math.min(numVectors, vocabulary.length); i++) {
        const vector: number[] = [];
        for (let j = 0; j < dimension; j++) {
          vector.push(modelData.readFloatLE(offset));
          offset += 4;
        }
        wordVectors.set(vocabulary[i], vector);
      }

      this.cachedModel = {
        wordVectors,
        vocabulary,
        dimension,
      };

      this.cacheTimestamp = now;

      return this.cachedModel;
    } catch (error) {
      throw new ModelLoadError(
        'Failed to load model files',
        error as Error
      );
    }
  }

  /**
   * Generate embedding for text
   *
   * Uses word averaging strategy: tokenize, lookup vectors, average.
   * Latency: ~5-20ms for typical blog post.
   *
   * @param text - Input text (title + body concatenation)
   * @returns Normalized embedding vector
   * @throws {Error} If text is empty
   */
  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const model = await this.load();

    // Tokenize text (simple whitespace + punctuation splitting)
    const tokens = this._tokenize(text);

    if (tokens.length === 0) {
      throw new Error('No valid tokens found in text');
    }

    // Lookup vectors for each token
    const vectors: number[][] = [];
    for (const token of tokens) {
      const vector = model.wordVectors.get(token.toLowerCase());
      if (vector) {
        vectors.push(vector);
      }
    }

    if (vectors.length === 0) {
      // Fallback: return zero vector if no tokens found
      return new Array(model.dimension).fill(0);
    }

    // Average vectors
    const embedding = new Array(model.dimension).fill(0);
    for (const vector of vectors) {
      for (let i = 0; i < model.dimension; i++) {
        embedding[i] += vector[i];
      }
    }

    for (let i = 0; i < model.dimension; i++) {
      embedding[i] /= vectors.length;
    }

    // Normalize to unit vector
    return this._normalize(embedding);
  }

  /**
   * Compute cosine similarity between two embeddings
   *
   * @param embedding1 - First embedding vector
   * @param embedding2 - Second embedding vector
   * @returns Similarity score in range [-1, 1]
   */
  computeSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      mag1 += embedding1[i] * embedding1[i];
      mag2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);

    if (magnitude === 0) {
      return 0;
    }

    // Clamp to [-1, 1] to handle floating-point precision errors
    const similarity = dotProduct / magnitude;
    return Math.max(-1, Math.min(1, similarity));
  }

  /**
   * Unload model from memory
   *
   * Frees cached model to reclaim memory.
   */
  async unload(): Promise<void> {
    this.cachedModel = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Tokenize text into words
   *
   * Simple tokenization: split on whitespace/punctuation
   * Handles multilingual content (Japanese, English)
   *
   * For Japanese text, tries to match vocabulary words by generating
   * all possible substrings (simple approach for testing).
   *
   * @private
   */
  private _tokenize(text: string): string[] {
    const tokens: string[] = [];

    // Split on whitespace
    const words = text.split(/\s+/);

    for (const word of words) {
      if (word.length === 0) continue;

      // Check if word contains Japanese characters
      if (/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/.test(word)) {
        // For Japanese text, generate all possible substrings
        // Example: "タグ提案" → ["タ", "グ", "タグ", "提", "案", "提案", "タグ提案"]
        // This allows matching compound words in vocabulary
        for (let i = 0; i < word.length; i++) {
          for (let j = i + 1; j <= word.length; j++) {
            tokens.push(word.substring(i, j));
          }
        }
      } else {
        // For English/Latin text, lowercase and remove punctuation
        const cleaned = word.toLowerCase().replace(/[^\w]/g, '');
        if (cleaned.length > 0) {
          tokens.push(cleaned);
        }
      }
    }

    return tokens;
  }

  /**
   * Normalize vector to unit length
   *
   * @private
   */
  private _normalize(vector: number[]): number[] {
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude === 0) {
      return vector;
    }

    return vector.map((val) => val / magnitude);
  }
}

/**
 * Factory function to create Model2Vec loader with environment config
 *
 * Reads MODEL_PATH from environment or uses default path.
 */
export function createModel2VecLoader(
  overrides?: Partial<Model2VecConfig>
): Model2VecLoader {
  const config: Model2VecConfig = {
    modelPath: process.env.MODEL_PATH || join(__dirname, 'model'),
    ...overrides,
  };

  return new Model2VecLoader(config);
}
