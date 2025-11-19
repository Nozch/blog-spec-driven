# Test Plan: Draft Storage Pipeline

**Created**: 2025-11-19
**Feature**: Personal Blog Publishing Flow - User Story 2 (Import Markdown/MDX)
**Scope**: `/api/articles/import` endpoint, `draftService`, and `S3 Draft Client`

---

## Executive Summary

This test plan covers the draft-storage pipeline responsible for importing Markdown/MDX files, validating them, storing draft blobs in S3, and persisting metadata in Supabase. The plan is structured by test layer (unit, integration) with explicit mock requirements and I/O expectations.

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │     │   draftService   │     │  S3 Draft       │
│   (validates    │────▶│   (business      │────▶│  Client         │
│   pre-upload)   │     │    layer)        │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                        │
                               │                        │
                               ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │   Supabase       │     │   AWS S3        │
                        │   (metadata)     │     │   (blob storage)│
                        └──────────────────┘     └─────────────────┘
```

**Responsibility Split**:
- **Frontend**: Pre-upload validation (size ≤8MB, extension .md/.mdx) - shows toast if invalid
- **draftService**: Re-validates, generates articleId, orchestrates S3 + Supabase writes
- **S3 Draft Client**: Low-level S3 operations with encryption

---

## Test Layers

### Layer 1: Unit Tests

#### 1.1 S3 Draft Client (`apps/web/lib/s3-draft-client.ts`)

**Test File**: `apps/web/src/lib/__tests__/s3-draft-client.test.ts`

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| S3-U001 | `getDraftObjectKey` generates correct key format | `{ authorId: "uuid-1", articleId: "uuid-2" }` | `"drafts/uuid-1/uuid-2.json"` | P0 |
| S3-U002 | `getDraftObjectKey` handles special characters in IDs | `{ authorId: "a-b-c", articleId: "1-2-3" }` | `"drafts/a-b-c/1-2-3.json"` | P1 |
| S3-U003 | `saveDraftObject` calls S3 PutObject with correct bucket | Valid params | `PutObjectCommand` called with `S3_DRAFT_BUCKET` | P0 |
| S3-U004 | `saveDraftObject` sets correct ContentType | `{ contentType: "application/json" }` | `ContentType: "application/json"` in command | P0 |
| S3-U005 | `saveDraftObject` uploads content as Uint8Array | `{ content: Uint8Array([...]) }` | Body matches input bytes | P0 |
| S3-U006 | `saveDraftObject` uploads content as Buffer | `{ content: Buffer.from(...) }` | Body matches input bytes | P0 |
| S3-U007 | `saveDraftObject` throws on S3 client error | S3 SDK throws `ServiceException` | Error propagated to caller | P0 |
| S3-U008 | `saveDraftObject` does not set custom encryption headers | Valid params | No `ServerSideEncryption` header (SSE-S3 is bucket default) | P1 |

**Mocks Required**:
```typescript
// Mock AWS SDK S3Client
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn(),
}));

// Mock environment variables
vi.mock('@/lib/env', () => ({
  serverEnv: {
    S3_DRAFT_BUCKET: 'test-bucket',
    AWS_REGION: 'ap-northeast-1',
  },
}));
```

---

#### 1.2 draftService (`apps/web/lib/draft-service.ts`)

**Test File**: `apps/web/src/lib/__tests__/draft-service.test.ts`

##### Validation Tests (Critical - Must Reject Before S3 Call)

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| DS-V001 | Rejects .docx files | File with `.docx` extension | `{ error: "INVALID_FORMAT", message: "Only .md and .mdx files are allowed" }` | P0 |
| DS-V002 | Rejects .txt files | File with `.txt` extension | `{ error: "INVALID_FORMAT" }` | P0 |
| DS-V003 | Rejects files without extension | File named `readme` | `{ error: "INVALID_FORMAT" }` | P0 |
| DS-V004 | Rejects files >8MB | 8.1 MB file | `{ error: "FILE_TOO_LARGE", message: "Files must be ≤8 MB" }` | P0 |
| DS-V005 | Rejects exactly 8MB + 1 byte | 8,388,609 bytes | `{ error: "FILE_TOO_LARGE" }` | P0 |
| DS-V006 | Accepts .md files | Valid `.md` file | Proceeds to S3 upload | P0 |
| DS-V007 | Accepts .mdx files | Valid `.mdx` file | Proceeds to S3 upload | P0 |
| DS-V008 | Accepts exactly 8MB file | 8,388,608 bytes | Proceeds to S3 upload | P1 |
| DS-V009 | Accepts case-insensitive extensions | `.MD`, `.MDX` | Proceeds to S3 upload | P1 |
| DS-V010 | **S3 NOT called on invalid file** | Invalid file | `saveDraftObject` never invoked | P0 |

##### Business Logic Tests

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| DS-B001 | Generates new articleId for new imports | Valid file, no existing articleId | Returns new UUID in response | P0 |
| DS-B002 | Uses existing articleId when provided | Valid file + `articleId` param | Preserves given articleId | P0 |
| DS-B003 | Calls S3 client with correct author/article IDs | Valid file, authenticated user | `saveDraftObject({ authorId, articleId, ... })` | P0 |
| DS-B004 | Sets status to "draft" | Valid import | `status: "draft"` in response | P0 |
| DS-B005 | Returns correct draftUrl format | `articleId: "abc-123"` | `draftUrl: "/compose/abc-123"` | P0 |
| DS-B006 | Writes metadata to Supabase | Valid import | Supabase insert/upsert called | P0 |
| DS-B007 | Returns complete response object | Valid import | `{ articleId, status: "draft", draftUrl }` | P0 |

##### Error Handling Tests

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| DS-E001 | Handles S3 upload failure gracefully | S3 throws error | Returns 500 with error message, no Supabase write | P0 |
| DS-E002 | Handles Supabase write failure | Supabase throws error | Returns 500, S3 object already uploaded (eventual consistency) | P0 |
| DS-E003 | Validates authorId is present | Missing auth context | Returns 401 Unauthorized | P0 |
| DS-E004 | Logs validation failures | Invalid file | Logger called with validation error details | P1 |
| DS-E005 | Logs successful imports | Valid import | Logger called with author_id, article_id | P1 |

**Mocks Required**:
```typescript
// Mock S3 Draft Client
vi.mock('@/lib/s3-draft-client', () => ({
  getDraftObjectKey: vi.fn((params) => `drafts/${params.authorId}/${params.articleId}.json`),
  saveDraftObject: vi.fn(),
}));

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  createSupabaseAuthClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-author-id' } },
        error: null
      }),
    },
  })),
}));

// Mock UUID generation
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid-1234'),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
```

---

### Layer 2: Integration Tests

**Test File**: `apps/web/src/lib/__tests__/draft-storage.integration.test.ts`

These tests verify the interaction between components with real implementations but mocked external services (S3, Supabase).

#### 2.1 Import Flow Integration

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| INT-001 | Complete import flow for valid .md file | Valid .md, authenticated user | articleId generated, S3 called, Supabase called, response correct | P0 |
| INT-002 | Complete import flow for valid .mdx file | Valid .mdx, authenticated user | Same as INT-001 | P0 |
| INT-003 | Validation rejects before any external calls | Invalid .docx | Neither S3 nor Supabase called | P0 |
| INT-004 | Size validation rejects before external calls | 10MB file | Neither S3 nor Supabase called | P0 |
| INT-005 | S3 failure prevents Supabase write | S3 mock throws | Supabase insert NOT called | P1 |
| INT-006 | Multiple sequential imports create unique IDs | 2 valid files | 2 distinct articleIds generated | P1 |

#### 2.2 Data Flow Verification

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| INT-007 | S3 receives correct object key | authorId: "a1", articleId: "b2" | Key: `drafts/a1/b2.json` | P0 |
| INT-008 | S3 receives correct content bytes | File content "# Hello" | Body matches UTF-8 encoded bytes | P0 |
| INT-009 | Supabase receives correct metadata | Valid import | Insert contains articleId, author_id, status, timestamps | P0 |
| INT-010 | ContentType set correctly for MDX | `.mdx` file | `contentType: "text/mdx"` or `"text/markdown"` | P1 |

**Mock Strategy for Integration Tests**:
```typescript
// Use MSW for API-level integration testing
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  // Mock S3 endpoint
  http.put('https://s3.ap-northeast-1.amazonaws.com/test-bucket/*', () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Mock Supabase REST API
  http.post('https://example.supabase.co/rest/v1/articles', () => {
    return HttpResponse.json({ id: 'article-id' });
  }),
);
```

---

### Layer 3: Contract Tests (API Route)

**Test File**: `apps/web/app/api/articles/import/__tests__/route.test.ts`

These tests verify the API route handler conforms to the OpenAPI contract.

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| API-001 | POST returns 201 for valid import | Valid multipart/form-data | `201`, `ArticleResponse` schema | P0 |
| API-002 | POST returns 400 for oversized file | 10MB file | `400`, error message | P0 |
| API-003 | POST returns 400 for invalid format | `.docx` file | `400`, error message per FR-012 | P0 |
| API-004 | POST returns 401 without auth | No auth headers | `401 Unauthorized` | P0 |
| API-005 | Response matches ArticleResponse schema | Valid import | `{ articleId, status, draftUrl }` | P0 |

---

## Mock Requirements Summary

| Module | Mock Type | Purpose |
|--------|-----------|---------|
| `@aws-sdk/client-s3` | Vitest mock | Avoid real S3 calls; capture command arguments |
| `@/lib/supabase` | Vitest mock | Control auth context and database responses |
| `@/lib/env` | Vitest mock | Provide test environment variables |
| `@/lib/logger` | Vitest mock | Verify logging calls without side effects |
| `crypto.randomUUID` | Vitest mock | Deterministic UUID generation for assertions |

---

## I/O Expectations

### draftService Input
```typescript
interface ImportRequest {
  file: File | Buffer | Uint8Array;
  filename: string;
  authorId: string;  // From auth context
  articleId?: string;  // Optional, generated if not provided
}
```

### draftService Output (Success)
```typescript
interface ImportResponse {
  articleId: string;  // UUID
  status: "draft";
  draftUrl: string;   // "/compose/{articleId}"
}
```

### draftService Output (Validation Error)
```typescript
interface ValidationError {
  error: "INVALID_FORMAT" | "FILE_TOO_LARGE";
  message: string;
}
```

### S3 Draft Client Input
```typescript
interface SaveDraftParams {
  authorId: string;
  articleId: string;
  content: Uint8Array | Buffer;
  contentType: string;  // "text/markdown" or "application/json"
}
```

### Supabase Metadata Row
```typescript
interface DraftStorageRow {
  article_id: string;
  author_id: string;
  s3_key: string;
  status: "draft";
  created_at: string;  // ISO timestamp
  updated_at: string;  // ISO timestamp
}
```

---

## Test Execution Order

1. **Unit Tests First** (fastest feedback loop):
   - `s3-draft-client.test.ts` - Pure function, no dependencies
   - `draft-service.test.ts` - Business logic with mocked dependencies

2. **Integration Tests Second**:
   - `draft-storage.integration.test.ts` - Component interactions

3. **Contract Tests Last**:
   - `route.test.ts` - API conformance

---

## Success Criteria

- [ ] All P0 test cases pass
- [ ] >80% code coverage for `draft-service.ts` and `s3-draft-client.ts`
- [ ] Validation rejections confirmed to occur **before** S3 calls
- [ ] Error messages match FR-012 specification
- [ ] Logging verified for all operations per OR-001

---

## Implementation Notes

### Critical Validation Order
The draftService **MUST** validate in this order:
1. Check file extension (.md/.mdx only)
2. Check file size (≤8MB)
3. Only then proceed to S3 upload

This ensures invalid uploads never reach external services, reducing costs and latency.

### Test Data Fixtures

Create fixtures at `apps/web/src/lib/__tests__/fixtures/`:
- `valid-article.md` - Small valid Markdown file
- `valid-article.mdx` - Small valid MDX file with JSX
- `oversized.md` - Generated 8.1MB file
- `exactly-8mb.md` - Generated 8MB file

### Environment Setup

```typescript
// vitest.setup.ts
process.env.S3_DRAFT_BUCKET = 'test-bucket';
process.env.AWS_REGION = 'ap-northeast-1';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
process.env.SUPABASE_SECRET_KEY = 'test-secret';
```

---

## Related Tasks

- **T049**: Implement draft storage logic with S3 encryption
- **T059**: Implement file size validation (≤8 MB)
- **T060**: Implement format validation (.md/.mdx only)
- **T067**: Create POST /api/articles/import route handler
- **T071**: Add logging for import validation failures

---

## Appendix: Test Case Rationale

### Why DS-V010 is Critical
The requirement explicitly states: "Reject invalid uploads **before** calling S3". This test verifies the safety layer that prevents wasted S3 API calls and ensures validation is truly server-side (not just frontend).

### Why INT-005 Tests S3 Failure Isolation
If S3 fails, we should not write orphan metadata to Supabase. This maintains data consistency between the blob store and metadata database.

### Why API-003 Must Match FR-012
The error message "Upload blocked: `<filename>` is [size] MB. Files must be ≤8 MB." is specified in FR-012 and must be returned verbatim for consistent UX across frontend/backend validation.
