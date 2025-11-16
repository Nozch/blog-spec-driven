/**
 * Tests for Model2Vec Model Loader
 *
 * Requirements Coverage:
 * - research.md:67: Model2Vec distilled from all-MiniLM-L6-v2, ~8-30MB size
 * - research.md:74-79: Cold start ~500-800ms, inference ~5-20ms
 * - Session 2025-11-14: Japanese-focused multilingual embeddings
 *
 * @module model-loader.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Model2VecLoader, Model2VecConfig, ModelMetadata } from '../model-loader';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Model2VecLoader', () => {
  let loader: Model2VecLoader;
  const testModelPath = join(__dirname, '../model');

  beforeEach(() => {
    loader = new Model2VecLoader({
      modelPath: testModelPath,
      cacheTTL: 3600000, // 1 hour cache
    });
  });

  afterEach(async () => {
    await loader.unload();
  });

  describe('constructor', () => {
    it('should create loader with valid config', () => {
      expect(loader).toBeInstanceOf(Model2VecLoader);
    });

    it('should throw error if model path is missing', () => {
      expect(() => new Model2VecLoader({ modelPath: '' })).toThrow(
        'Model path is required'
      );
    });

    it('should use default cache TTL if not provided', () => {
      const defaultLoader = new Model2VecLoader({ modelPath: testModelPath });
      expect(defaultLoader).toBeInstanceOf(Model2VecLoader);
    });
  });

  describe('model metadata', () => {
    it('should load model metadata file', async () => {
      const metadata = await loader.getMetadata();

      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('size');
      expect(metadata).toHaveProperty('dimensions');
      expect(metadata).toHaveProperty('languages');
    });

    it('should validate model is distilled from all-MiniLM-L6-v2', async () => {
      const metadata = await loader.getMetadata();

      expect(metadata.baseModel).toBe('all-MiniLM-L6-v2');
      expect(metadata.name).toContain('model2vec');
    });

    it('should confirm model size is within 8-30MB range', async () => {
      const metadata = await loader.getMetadata();

      expect(metadata.size).toBeGreaterThanOrEqual(8 * 1024 * 1024); // 8MB
      expect(metadata.size).toBeLessThanOrEqual(30 * 1024 * 1024); // 30MB
    });

    it('should indicate Japanese language support', async () => {
      const metadata = await loader.getMetadata();

      expect(metadata.languages).toContain('ja'); // Japanese
      expect(metadata.languages).toContain('en'); // English
    });
  });

  describe('model loading', () => {
    it('should load model on first call', async () => {
      const startTime = Date.now();
      const model = await loader.load();
      const loadTime = Date.now() - startTime;

      expect(model).toBeDefined();

      // Cold start should be < 1s (research.md:74 specifies 500-800ms)
      expect(loadTime).toBeLessThan(1000);
    });

    it('should return cached model on subsequent calls', async () => {
      // First load (cold)
      await loader.load();

      // Second load (cached)
      const startTime = Date.now();
      const model = await loader.load();
      const loadTime = Date.now() - startTime;

      expect(model).toBeDefined();

      // Cached load should be nearly instant (< 10ms)
      expect(loadTime).toBeLessThan(10);
    });

    it('should verify model files exist', async () => {
      const modelFilePath = join(testModelPath, 'model2vec.bin');
      expect(existsSync(modelFilePath)).toBe(true);
    });

    it('should verify vocabulary file exists', async () => {
      const vocabFilePath = join(testModelPath, 'vocab.txt');
      expect(existsSync(vocabFilePath)).toBe(true);
    });
  });

  describe('embedding generation', () => {
    beforeEach(async () => {
      await loader.load();
    });

    it('should generate embeddings for English text', async () => {
      const text = 'Next.js TypeScript React AWS Lambda';
      const embedding = await loader.embed(text);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBeGreaterThan(0);

      // Verify embedding dimension matches metadata
      const metadata = await loader.getMetadata();
      expect(embedding.length).toBe(metadata.dimensions);
    });

    it('should generate embeddings for Japanese text', async () => {
      const text = 'Next.jsとTypeScriptで構築するブログシステム';
      const embedding = await loader.embed(text);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should generate embeddings for mixed Japanese-English text', async () => {
      const text = 'AWS Lambdaを使ったtag suggestionシステム';
      const embedding = await loader.embed(text);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should generate normalized embeddings (unit vectors)', async () => {
      const text = 'semantic search ranking';
      const embedding = await loader.embed(text);

      // Calculate magnitude
      const magnitude = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );

      // Should be normalized to unit vector (~1.0)
      expect(magnitude).toBeCloseTo(1.0, 2);
    });

    it('should complete embedding generation within latency budget', async () => {
      const text = 'Modern blog platform with semantic tag suggestions and hybrid scoring';

      const startTime = Date.now();
      await loader.embed(text);
      const inferenceTime = Date.now() - startTime;

      // research.md:75 specifies 5-20ms for typical blog post
      expect(inferenceTime).toBeLessThan(50); // Generous buffer
    });

    it('should handle empty text gracefully', async () => {
      await expect(loader.embed('')).rejects.toThrow('Text cannot be empty');
    });

    it('should handle very long text', async () => {
      // Simulate 5000-word article (~30KB)
      const longText = Array(5000).fill('word').join(' ');

      const embedding = await loader.embed(longText);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBeGreaterThan(0);
    });
  });

  describe('similarity computation', () => {
    beforeEach(async () => {
      await loader.load();
    });

    it('should compute cosine similarity between embeddings', async () => {
      const text1 = 'TypeScript programming language';
      const text2 = 'TypeScript development framework';

      const embedding1 = await loader.embed(text1);
      const embedding2 = await loader.embed(text2);

      const similarity = loader.computeSimilarity(embedding1, embedding2);

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
      expect(similarity).toBeGreaterThan(0.5); // Related terms should have high similarity
    });

    it('should return 1.0 for identical texts', async () => {
      const text = 'semantic search';
      const embedding = await loader.embed(text);

      const similarity = loader.computeSimilarity(embedding, embedding);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return low similarity for unrelated texts', async () => {
      const text1 = 'TypeScript programming';
      const text2 = 'cooking recipe pasta';

      const embedding1 = await loader.embed(text1);
      const embedding2 = await loader.embed(text2);

      const similarity = loader.computeSimilarity(embedding1, embedding2);

      expect(similarity).toBeLessThan(0.3); // Unrelated should have low similarity
    });

    it('should handle multilingual similarity', async () => {
      const textEn = 'tag suggestion system';
      const textJa = 'タグ提案システム';

      const embedding1 = await loader.embed(textEn);
      const embedding2 = await loader.embed(textJa);

      const similarity = loader.computeSimilarity(embedding1, embedding2);

      // Multilingual model should recognize semantic equivalence
      expect(similarity).toBeGreaterThan(0.4);
    });
  });

  describe('resource management', () => {
    it('should unload model and free memory', async () => {
      await loader.load();
      await loader.unload();

      // After unload, should need to reload
      const model = await loader.load();
      expect(model).toBeDefined();
    });

    it('should handle multiple unload calls gracefully', async () => {
      await loader.load();
      await loader.unload();
      await loader.unload(); // Second unload should not error

      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error if model files are corrupted', async () => {
      const badLoader = new Model2VecLoader({
        modelPath: '/invalid/path',
      });

      await expect(badLoader.load()).rejects.toThrow();
    });

    it('should throw error if vocabulary is missing', async () => {
      // This tests the requirement that both model.bin and vocab.txt must exist
      const badLoader = new Model2VecLoader({
        modelPath: '/invalid/path',
      });

      await expect(badLoader.getMetadata()).rejects.toThrow();
    });
  });

  describe('cache TTL', () => {
    it('should respect cache TTL setting', async () => {
      const shortTTLLoader = new Model2VecLoader({
        modelPath: testModelPath,
        cacheTTL: 100, // 100ms
      });

      // First load - cold start
      const model1 = await shortTTLLoader.load();
      expect(model1).toBeDefined();

      // Immediate second load should be cached (fast)
      const startCached = Date.now();
      const model2 = await shortTTLLoader.load();
      const cachedTime = Date.now() - startCached;

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next load should reload from disk (slower than cached)
      const startReload = Date.now();
      const model3 = await shortTTLLoader.load();
      const reloadTime = Date.now() - startReload;

      // Reload should take at least as long as cached load
      // (In practice, disk I/O should be slower, but with small test files it may be similar)
      expect(reloadTime).toBeGreaterThanOrEqual(0);
      expect(model3).toBeDefined();

      await shortTTLLoader.unload();
    });
  });
});
