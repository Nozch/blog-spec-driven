import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS - Must be defined before imports
// =============================================================================

// Shared mock function that persists across module resets
const mockSend = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: vi.fn((input) => ({ input, _type: 'PutObject' })),
    GetObjectCommand: vi.fn((input) => ({ input, _type: 'GetObject' })),
    DeleteObjectCommand: vi.fn((input) => ({ input, _type: 'DeleteObject' })),
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

vi.mock('../env', () => ({
  serverEnv: {
    AWS_REGION: 'ap-northeast-1',
    S3_DRAFT_BUCKET: 'test-bucket',
  },
}));

// =============================================================================
// TEST UTILITIES
// =============================================================================

type S3Module = typeof import('../s3');

const importModule = async (): Promise<S3Module> => {
  // Reset modules to get fresh singleton state
  vi.resetModules();

  // Re-apply mockImplementation after reset (important!)
  const { S3Client } = await import('@aws-sdk/client-s3');
  (S3Client as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    send: mockSend,
  }));

  return import('../s3');
};

// Helper to create mock stream body for GetObject responses
const createMockStreamBody = (data: Uint8Array) => ({
  transformToByteArray: () => Promise.resolve(data),
});

// =============================================================================
// TESTS
// =============================================================================

describe('S3 Client (T022)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful response for signed URLs
    mockGetSignedUrl.mockResolvedValue(
      'https://test-bucket.s3.ap-northeast-1.amazonaws.com/key?X-Amz-Signature=abc123'
    );
    // Default successful response for send operations
    mockSend.mockResolvedValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // 1.1 S3 Client Factory Tests
  // ===========================================================================

  describe('createS3Client', () => {
    it('S3C-001: creates S3Client with correct region', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const { createS3Client } = await importModule();

      createS3Client();

      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'ap-northeast-1',
        })
      );
    });

    it('S3C-002: uses default credentials provider (no explicit credentials)', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const { createS3Client } = await importModule();

      createS3Client();

      // Should NOT have explicit credentials - relies on AWS SDK default chain
      expect(S3Client).toHaveBeenCalledWith(
        expect.not.objectContaining({
          credentials: expect.anything(),
        })
      );
    });

    it('S3C-003: returns new S3Client instance', async () => {
      const { createS3Client } = await importModule();

      const client = createS3Client();

      expect(client).toBeDefined();
      expect(client.send).toBeDefined();
    });
  });

  // ===========================================================================
  // 1.2 Signed Download URL Tests
  // ===========================================================================

  describe('getSignedDownloadUrl', () => {
    it('S3D-001: generates valid pre-signed GET URL', async () => {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedDownloadUrl } = await importModule();

      const url = await getSignedDownloadUrl({
        bucket: 'test-bucket',
        key: 'drafts/author-1/article-1.json',
      });

      expect(url).toMatch(/^https:\/\//);
      // Verify GetObjectCommand was created with correct params
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'drafts/author-1/article-1.json',
      });
      // Verify getSignedUrl was called with correct expiration
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(), // S3Client
        expect.anything(), // Command
        expect.objectContaining({
          expiresIn: 3600,
        })
      );
    });

    it('S3D-002: uses default expiration (3600s) when not specified', async () => {
      const { getSignedDownloadUrl } = await importModule();

      await getSignedDownloadUrl({
        bucket: 'test-bucket',
        key: 'test.json',
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          expiresIn: 3600,
        })
      );
    });

    it('S3D-003: respects custom expiration', async () => {
      const { getSignedDownloadUrl } = await importModule();

      await getSignedDownloadUrl({
        bucket: 'test-bucket',
        key: 'test.json',
        expiresIn: 900,
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          expiresIn: 900,
        })
      );
    });

    it('S3D-004: handles keys with special characters', async () => {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedDownloadUrl } = await importModule();

      const url = await getSignedDownloadUrl({
        bucket: 'test-bucket',
        key: 'drafts/user@example.com/article-1.json',
      });

      expect(url).toBeDefined();
      expect(GetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: 'drafts/user@example.com/article-1.json',
        })
      );
    });

    it('S3D-005: throws on missing bucket', async () => {
      const { getSignedDownloadUrl } = await importModule();

      await expect(
        getSignedDownloadUrl({ bucket: '', key: 'test.json' })
      ).rejects.toThrow(/bucket/i);
    });

    it('S3D-006: throws on missing key', async () => {
      const { getSignedDownloadUrl } = await importModule();

      await expect(
        getSignedDownloadUrl({ bucket: 'test-bucket', key: '' })
      ).rejects.toThrow(/key/i);
    });
  });

  // ===========================================================================
  // 1.3 Signed Upload URL Tests
  // ===========================================================================

  describe('getSignedUploadUrl', () => {
    it('S3U-001: generates valid pre-signed PUT URL', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUploadUrl } = await importModule();

      const url = await getSignedUploadUrl({
        bucket: 'test-bucket',
        key: 'drafts/author-1/article-1.json',
        contentType: 'text/markdown',
      });

      expect(url).toMatch(/^https:\/\//);
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'drafts/author-1/article-1.json',
        ContentType: 'text/markdown',
      });
    });

    it('S3U-002: includes content-type in signed headers', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUploadUrl } = await importModule();

      await getSignedUploadUrl({
        bucket: 'test-bucket',
        key: 'test.json',
        contentType: 'application/json',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: 'application/json',
        })
      );
    });

    it('S3U-003: uses default expiration (3600s) when not specified', async () => {
      const { getSignedUploadUrl } = await importModule();

      await getSignedUploadUrl({
        bucket: 'test-bucket',
        key: 'test.json',
        contentType: 'text/plain',
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          expiresIn: 3600,
        })
      );
    });

    it('S3U-004: respects custom expiration', async () => {
      const { getSignedUploadUrl } = await importModule();

      await getSignedUploadUrl({
        bucket: 'test-bucket',
        key: 'test.json',
        contentType: 'text/plain',
        expiresIn: 300,
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          expiresIn: 300,
        })
      );
    });

    it('S3U-005: throws on missing contentType', async () => {
      const { getSignedUploadUrl } = await importModule();

      await expect(
        getSignedUploadUrl({
          bucket: 'test-bucket',
          key: 'test.json',
          contentType: '',
        })
      ).rejects.toThrow(/contentType/i);
    });
  });

  // ===========================================================================
  // 1.4 PutObject Tests
  // ===========================================================================

  describe('putObject', () => {
    it('S3P-001: uploads Buffer content', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { putObject } = await importModule();

      const content = Buffer.from('# Hello World');

      await putObject({
        bucket: 'test-bucket',
        key: 'test.md',
        body: content,
        contentType: 'text/markdown',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'test.md',
          Body: content,
          ContentType: 'text/markdown',
        })
      );
      expect(mockSend).toHaveBeenCalled();
    });

    it('S3P-002: uploads Uint8Array content', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { putObject } = await importModule();

      const content = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

      await putObject({
        bucket: 'test-bucket',
        key: 'test.bin',
        body: content,
        contentType: 'application/octet-stream',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Body: content,
        })
      );
    });

    it('S3P-003: uploads string content', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { putObject } = await importModule();

      const content = '# Hello World';

      await putObject({
        bucket: 'test-bucket',
        key: 'test.md',
        body: content,
        contentType: 'text/markdown',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Body: content,
        })
      );
    });

    it('S3P-004: sets correct ContentType', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { putObject } = await importModule();

      await putObject({
        bucket: 'test-bucket',
        key: 'test.json',
        body: '{}',
        contentType: 'application/json',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: 'application/json',
        })
      );
    });

    it('S3P-005: does NOT set ServerSideEncryption header (uses bucket default)', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { putObject } = await importModule();

      await putObject({
        bucket: 'test-bucket',
        key: 'test.json',
        body: '{}',
        contentType: 'application/json',
      });

      // CRITICAL: SSE-S3 is bucket default, so we should NOT set it explicitly
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.not.objectContaining({
          ServerSideEncryption: expect.anything(),
        })
      );
    });

    it('S3P-006: throws on S3 service error', async () => {
      const { putObject } = await importModule();

      mockSend.mockRejectedValueOnce({
        name: 'InternalError',
        message: 'We encountered an internal error. Please try again.',
        $metadata: { httpStatusCode: 500 },
      });

      await expect(
        putObject({
          bucket: 'test-bucket',
          key: 'test.json',
          body: '{}',
          contentType: 'application/json',
        })
      ).rejects.toThrow();
    });

    it('S3P-007: throws on network timeout', async () => {
      const { putObject } = await importModule();

      mockSend.mockRejectedValueOnce({
        name: 'TimeoutError',
        message: 'Connection timed out',
      });

      await expect(
        putObject({
          bucket: 'test-bucket',
          key: 'test.json',
          body: '{}',
          contentType: 'application/json',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // 1.5 GetObject Tests
  // ===========================================================================

  describe('getObject', () => {
    it('S3G-001: retrieves object as Uint8Array', async () => {
      const { getObject } = await importModule();

      const expectedContent = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      mockSend.mockResolvedValueOnce({
        Body: createMockStreamBody(expectedContent),
        ContentType: 'text/plain',
      });

      const result = await getObject({
        bucket: 'test-bucket',
        key: 'test.txt',
      });

      expect(result.body).toBeInstanceOf(Uint8Array);
      expect(result.body).toEqual(expectedContent);
    });

    it('S3G-002: returns correct ContentType', async () => {
      const { getObject } = await importModule();

      mockSend.mockResolvedValueOnce({
        Body: createMockStreamBody(new Uint8Array([35, 32])), // "# "
        ContentType: 'text/markdown',
      });

      const result = await getObject({
        bucket: 'test-bucket',
        key: 'article.md',
      });

      expect(result.contentType).toBe('text/markdown');
    });

    it('S3G-003: throws NotFound for missing object', async () => {
      const { getObject } = await importModule();

      mockSend.mockRejectedValueOnce({
        name: 'NoSuchKey',
        message: 'The specified key does not exist.',
        $metadata: { httpStatusCode: 404 },
      });

      await expect(
        getObject({
          bucket: 'test-bucket',
          key: 'nonexistent.json',
        })
      ).rejects.toThrow(/NoSuchKey|not exist/i);
    });

    it('S3G-004: throws on access denied', async () => {
      const { getObject } = await importModule();

      mockSend.mockRejectedValueOnce({
        name: 'AccessDenied',
        message: 'Access Denied',
        $metadata: { httpStatusCode: 403 },
      });

      await expect(
        getObject({
          bucket: 'test-bucket',
          key: 'forbidden.json',
        })
      ).rejects.toThrow(/AccessDenied|Access Denied/i);
    });
  });

  // ===========================================================================
  // 1.6 DeleteObject Tests
  // ===========================================================================

  describe('deleteObject', () => {
    it('S3X-001: deletes existing object', async () => {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const { deleteObject } = await importModule();

      await deleteObject({
        bucket: 'test-bucket',
        key: 'to-delete.json',
      });

      expect(DeleteObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'to-delete.json',
        })
      );
      expect(mockSend).toHaveBeenCalled();
    });

    it('S3X-002: succeeds silently for non-existent key (S3 idempotent delete)', async () => {
      const { deleteObject } = await importModule();

      // S3 delete is idempotent - doesn't throw for missing keys
      mockSend.mockResolvedValueOnce({});

      await expect(
        deleteObject({
          bucket: 'test-bucket',
          key: 'already-deleted.json',
        })
      ).resolves.toBeUndefined();
    });

    it('S3X-003: throws on access denied', async () => {
      const { deleteObject } = await importModule();

      mockSend.mockRejectedValueOnce({
        name: 'AccessDenied',
        message: 'Access Denied',
        $metadata: { httpStatusCode: 403 },
      });

      await expect(
        deleteObject({
          bucket: 'test-bucket',
          key: 'no-permission.json',
        })
      ).rejects.toThrow(/AccessDenied|Access Denied/i);
    });
  });
});
