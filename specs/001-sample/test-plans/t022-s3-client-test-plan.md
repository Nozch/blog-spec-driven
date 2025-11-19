# Test Plan: T022 - S3 Client with Signed URL Generation

**Created**: 2025-11-19
**Task**: T022 - Implement S3 client with signed URL generation in `apps/web/lib/s3.ts`
**Phase**: Phase 2 - Foundational (Blocking Prerequisites)
**Priority**: P0 - Blocks User Story 2 (Import) and draft storage pipeline

---

## Executive Summary

This test plan defines the TDD specifications for T022, a foundational S3 client module that provides:
1. S3 client factory with proper AWS credentials
2. Signed URL generation for secure draft access
3. Basic object operations (put, get, delete)

This module is consumed by the higher-level `s3-draft-client.ts` (draft-storage pipeline).

---

## Module Responsibilities

Based on research.md and the project architecture:

```typescript
// Expected public API for apps/web/lib/s3.ts

// Factory function to create configured S3 client
export function createS3Client(): S3Client;

// Generate pre-signed URL for GET operations (draft retrieval)
export async function getSignedDownloadUrl(params: {
  bucket: string;
  key: string;
  expiresIn?: number; // seconds, default 3600
}): Promise<string>;

// Generate pre-signed URL for PUT operations (draft upload from browser)
export async function getSignedUploadUrl(params: {
  bucket: string;
  key: string;
  contentType: string;
  expiresIn?: number; // seconds, default 3600
}): Promise<string>;

// Direct object operations for server-side use
export async function putObject(params: {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}): Promise<void>;

export async function getObject(params: {
  bucket: string;
  key: string;
}): Promise<{ body: Uint8Array; contentType: string }>;

export async function deleteObject(params: {
  bucket: string;
  key: string;
}): Promise<void>;
```

---

## Test Layers

### Layer 1: Unit Tests

**Test File**: `apps/web/src/lib/__tests__/s3.test.ts`

#### 1.1 S3 Client Factory Tests

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| S3C-001 | Creates S3Client with correct region | N/A | `S3Client` instantiated with `AWS_REGION` from env | P0 |
| S3C-002 | Uses default credentials provider | N/A | No explicit credentials passed (uses AWS SDK default chain) | P0 |
| S3C-003 | Returns singleton or new instance per call | Multiple calls | Consistent behavior (document which pattern) | P1 |

#### 1.2 Signed Download URL Tests

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| S3D-001 | Generates valid pre-signed GET URL | `{ bucket: "test", key: "drafts/a/b.json" }` | URL contains bucket, key, signature params | P0 |
| S3D-002 | Uses default expiration (3600s) | No `expiresIn` provided | URL expires in ~1 hour | P0 |
| S3D-003 | Respects custom expiration | `{ expiresIn: 900 }` | URL expires in ~15 minutes | P0 |
| S3D-004 | Handles keys with special characters | `{ key: "drafts/user@example/article-1.json" }` | Properly URL-encoded key | P1 |
| S3D-005 | Throws on missing bucket | `{ bucket: "", key: "test" }` | Throws validation error | P0 |
| S3D-006 | Throws on missing key | `{ bucket: "test", key: "" }` | Throws validation error | P0 |

#### 1.3 Signed Upload URL Tests

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| S3U-001 | Generates valid pre-signed PUT URL | `{ bucket, key, contentType: "text/markdown" }` | URL with PUT method signature | P0 |
| S3U-002 | Includes content-type in signed headers | `{ contentType: "application/json" }` | Content-Type header required for upload | P0 |
| S3U-003 | Uses default expiration (3600s) | No `expiresIn` provided | URL expires in ~1 hour | P0 |
| S3U-004 | Respects custom expiration | `{ expiresIn: 300 }` | URL expires in ~5 minutes | P1 |
| S3U-005 | Throws on missing contentType | `{ bucket, key, contentType: "" }` | Throws validation error | P0 |

#### 1.4 PutObject Tests

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| S3P-001 | Uploads Buffer content | `{ body: Buffer.from("test") }` | `PutObjectCommand` sent with body | P0 |
| S3P-002 | Uploads Uint8Array content | `{ body: new Uint8Array([...]) }` | `PutObjectCommand` sent with body | P0 |
| S3P-003 | Uploads string content | `{ body: "# Hello" }` | `PutObjectCommand` sent with body | P0 |
| S3P-004 | Sets correct ContentType | `{ contentType: "text/markdown" }` | Command includes ContentType | P0 |
| S3P-005 | Does NOT set ServerSideEncryption header | Valid params | No SSE header (bucket default SSE-S3) | P0 |
| S3P-006 | Throws on S3 service error | S3 returns error | Error propagated with context | P0 |
| S3P-007 | Throws on network timeout | Network failure | Timeout error with retry hint | P1 |

#### 1.5 GetObject Tests

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| S3G-001 | Retrieves object as Uint8Array | Valid key | `{ body: Uint8Array, contentType }` | P0 |
| S3G-002 | Returns correct ContentType | Object with `text/markdown` | `contentType: "text/markdown"` | P0 |
| S3G-003 | Throws NotFound for missing object | Non-existent key | `NoSuchKey` error | P0 |
| S3G-004 | Throws on access denied | No permissions | `AccessDenied` error | P0 |

#### 1.6 DeleteObject Tests

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| S3X-001 | Deletes existing object | Valid key | Resolves successfully | P0 |
| S3X-002 | Succeeds silently for non-existent key | Missing key | Resolves (S3 idempotent delete) | P0 |
| S3X-003 | Throws on access denied | No delete permission | `AccessDenied` error | P1 |

---

### Layer 2: Integration Tests (Optional - for CI with LocalStack)

**Test File**: `apps/web/src/lib/__tests__/s3.integration.test.ts`

These tests run against LocalStack or real S3 (in CI) to verify actual AWS SDK behavior.

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| S3I-001 | Round-trip: put then get object | Upload + download | Content matches | P1 |
| S3I-002 | Signed download URL is accessible | Generate URL, fetch it | Returns object content | P1 |
| S3I-003 | Signed upload URL accepts PUT | Generate URL, PUT to it | Object created in bucket | P1 |
| S3I-004 | Delete removes object | Delete then get | NotFound error | P1 |

---

## Mock Requirements

### Primary Mocks

```typescript
// apps/web/src/lib/__tests__/s3.test.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock AWS SDK v3
const mockSend = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({
    send: mockSend,
  })),
  PutObjectCommand: vi.fn((input) => ({ input, _type: 'PutObject' })),
  GetObjectCommand: vi.fn((input) => ({ input, _type: 'GetObject' })),
  DeleteObjectCommand: vi.fn((input) => ({ input, _type: 'DeleteObject' })),
}));

// Mock presigner
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://bucket.s3.amazonaws.com/key?signed=params'),
}));

// Mock environment
vi.mock('@/lib/env', () => ({
  serverEnv: {
    AWS_REGION: 'ap-northeast-1',
    S3_DRAFT_BUCKET: 'test-bucket',
  },
}));
```

### Mock Response Patterns

```typescript
// Successful GetObject response
mockSend.mockResolvedValueOnce({
  Body: {
    transformToByteArray: () => Promise.resolve(new Uint8Array([72, 101, 108, 108, 111])),
  },
  ContentType: 'text/markdown',
});

// NotFound error
mockSend.mockRejectedValueOnce({
  name: 'NoSuchKey',
  message: 'The specified key does not exist.',
  $metadata: { httpStatusCode: 404 },
});

// Access denied error
mockSend.mockRejectedValueOnce({
  name: 'AccessDenied',
  message: 'Access Denied',
  $metadata: { httpStatusCode: 403 },
});

// Service error (500)
mockSend.mockRejectedValueOnce({
  name: 'InternalError',
  message: 'We encountered an internal error. Please try again.',
  $metadata: { httpStatusCode: 500 },
});
```

---

## I/O Expectations

### Input Types

```typescript
// Signed URL parameters
interface SignedUrlParams {
  bucket: string;
  key: string;
  expiresIn?: number;  // seconds, default 3600
}

interface SignedUploadUrlParams extends SignedUrlParams {
  contentType: string;
}

// Object operation parameters
interface PutObjectParams {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}

interface GetObjectParams {
  bucket: string;
  key: string;
}

interface DeleteObjectParams {
  bucket: string;
  key: string;
}
```

### Output Types

```typescript
// Signed URL output
type SignedUrl = string;  // Full presigned URL

// GetObject output
interface GetObjectResult {
  body: Uint8Array;
  contentType: string;
}

// PutObject/DeleteObject output
type VoidResult = void;  // Resolves on success, throws on error
```

### Error Types

```typescript
// Custom error wrapper (optional, for better DX)
class S3Error extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'ACCESS_DENIED' | 'SERVICE_ERROR' | 'VALIDATION_ERROR',
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'S3Error';
  }
}
```

---

## Test Execution

### Setup

```typescript
// vitest.setup.ts additions
process.env.AWS_REGION = 'ap-northeast-1';
process.env.S3_DRAFT_BUCKET = 'test-bucket';
```

### Run Commands

```bash
# Unit tests only
pnpm vitest apps/web/src/lib/__tests__/s3.test.ts

# With coverage
pnpm vitest --coverage apps/web/src/lib/__tests__/s3.test.ts

# Watch mode during development
pnpm vitest --watch apps/web/src/lib/__tests__/s3.test.ts
```

---

## Success Criteria

- [ ] All P0 test cases pass
- [ ] >90% code coverage for `s3.ts`
- [ ] No direct AWS credentials in code (uses default provider chain)
- [ ] SSE-S3 encryption NOT explicitly set (relies on bucket default)
- [ ] Error messages include actionable context
- [ ] TypeScript types exported for consumers

---

## Implementation Notes

### Why No Explicit SSE Headers?

Per research.md:2, the S3 bucket is configured with SSE-S3 as the default encryption:
```bash
aws s3api put-bucket-encryption --bucket $S3_DRAFT_BUCKET \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

Setting `ServerSideEncryption: 'AES256'` in PutObject is redundant and could cause confusion. Test S3P-005 ensures we don't add unnecessary headers.

### Signed URL Security

- **Download URLs**: Allow anyone with the URL to GET the object (time-limited)
- **Upload URLs**: Require matching Content-Type header to prevent abuse
- **Expiration**: Default 1 hour balances usability vs security

### Relationship to s3-draft-client.ts

```
┌─────────────────────┐
│  s3-draft-client.ts │  Uses T022's putObject()
│  (domain layer)     │  for saveDraftObject()
└─────────┬───────────┘
          │ imports
          ▼
┌─────────────────────┐
│  s3.ts (T022)       │  This module
│  (infrastructure)   │
└─────────────────────┘
```

The draft client adds:
- Key format: `drafts/{authorId}/{articleId}.json`
- Domain-specific error handling
- Logging with author_id/article_id context

---

## Related Tasks

- **T022**: This task - S3 client implementation
- **T049**: Implement draft storage logic (consumes T022)
- **T067**: POST /api/articles/import route (consumes draft storage)

---

## Appendix: Sample Test Implementation

```typescript
// apps/web/src/lib/__tests__/s3.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Import after mocks are set up
const importModule = async () => {
  vi.resetModules();
  return import('../s3');
};

describe('S3 Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSignedDownloadUrl', () => {
    it('S3D-001: generates valid pre-signed GET URL', async () => {
      const { getSignedDownloadUrl } = await importModule();

      const url = await getSignedDownloadUrl({
        bucket: 'test-bucket',
        key: 'drafts/author-1/article-1.json',
      });

      expect(url).toMatch(/^https:\/\//);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'drafts/author-1/article-1.json',
          }),
        }),
        expect.objectContaining({
          expiresIn: 3600,
        })
      );
    });

    it('S3D-005: throws on missing bucket', async () => {
      const { getSignedDownloadUrl } = await importModule();

      await expect(
        getSignedDownloadUrl({ bucket: '', key: 'test' })
      ).rejects.toThrow(/bucket/i);
    });
  });

  describe('putObject', () => {
    it('S3P-005: does NOT set ServerSideEncryption header', async () => {
      const { putObject } = await importModule();
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      await putObject({
        bucket: 'test-bucket',
        key: 'test.json',
        body: Buffer.from('test'),
        contentType: 'application/json',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.not.objectContaining({
          ServerSideEncryption: expect.anything(),
        })
      );
    });
  });
});
```

---

## Checklist Before Implementation

- [ ] Review AWS SDK v3 documentation for S3Client
- [ ] Review @aws-sdk/s3-request-presigner for getSignedUrl
- [ ] Verify env.ts has AWS_REGION and S3_DRAFT_BUCKET
- [ ] Create test file with all P0 test stubs
- [ ] Run tests (should all fail - red phase)
- [ ] Implement s3.ts to make tests pass (green phase)
- [ ] Refactor for clarity (refactor phase)
