import { beforeEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// MOCKS (must be before imports)
// =============================================================================

vi.mock('@/lib/tag-ranker-client', () => {
  const mockSuggest = vi.fn();
  return {
    HttpTagRankerClient: vi.fn(() => ({
      suggest: mockSuggest,
    })),
    TagRankerRequestError: class extends Error {
      constructor(
        message: string,
        public status?: number,
        public bodyText?: string
      ) {
        super(message);
        this.name = 'TagRankerRequestError';
      }
    },
    mockSuggest,
  };
});

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

import { POST } from '../route';
import { mockSuggest, TagRankerRequestError } from '@/lib/tag-ranker-client';

// =============================================================================
// TEST UTILITIES
// =============================================================================

const createRequest = (body: any) => {
  return new Request('https://example.com/api/articles/123/tags/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/articles/[articleId]/tags/suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // B1: Happy path with tags
  // ===========================================================================

  it('B1: returns 200 with tags on successful suggestion', async () => {
    const successResponse = {
      success: true as const,
      tags: [
        { tag: 'typescript', score: 0.92 },
        { tag: 'nextjs', score: 0.87 },
      ],
    };
    mockSuggest.mockResolvedValueOnce(successResponse);

    const request = createRequest({
      title: 'Building with Next.js',
      body: 'A comprehensive guide to Next.js and TypeScript integration.',
      minScore: 0.5,
      maxTags: 5,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(successResponse);

    // Verify the client was called with correct content
    expect(mockSuggest).toHaveBeenCalledWith({
      content: 'Building with Next.js\n\nA comprehensive guide to Next.js and TypeScript integration.',
      minScore: 0.5,
      maxTags: 5,
    });
  });

  // ===========================================================================
  // B2: Happy path with empty tags
  // ===========================================================================

  it('B2: returns 200 with empty tags array when no tags found', async () => {
    const emptyResponse = {
      success: true as const,
      tags: [],
      message: 'No tags met the minimum score threshold',
    };
    mockSuggest.mockResolvedValueOnce(emptyResponse);

    const request = createRequest({
      title: 'Short',
      body: 'Brief',
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(emptyResponse);

    // Verify minScore and maxTags are omitted when not provided
    expect(mockSuggest).toHaveBeenCalledWith({
      content: 'Short\n\nBrief',
    });
  });

  // ===========================================================================
  // B3: Lambda/domain failure (success: false)
  // ===========================================================================

  it('B3: returns 400 when Lambda returns success: false', async () => {
    const failureResponse = {
      success: false as const,
      error: 'Content too short for meaningful analysis',
    };
    mockSuggest.mockResolvedValueOnce(failureResponse);

    const request = createRequest({
      title: 'Hi',
      body: 'Lo',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual(failureResponse);
  });

  // ===========================================================================
  // B4: Client throws TagRankerRequestError
  // ===========================================================================

  it('B4: returns 502 when TagRankerClient throws', async () => {
    const error = new TagRankerRequestError(
      'Tag ranker service unreachable',
      undefined,
      undefined
    );
    mockSuggest.mockRejectedValueOnce(error);

    const request = createRequest({
      title: 'Test Title',
      body: 'Test Body',
    });

    const response = await POST(request);

    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: 'Tag suggestion service unavailable.',
    });
  });

  // ===========================================================================
  // B5: Invalid request body
  // ===========================================================================

  it('B5: returns 400 when title is missing', async () => {
    const request = createRequest({
      body: 'Test Body',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: 'Both title and body are required',
    });
  });

  it('B5: returns 400 when body is missing', async () => {
    const request = createRequest({
      title: 'Test Title',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: 'Both title and body are required',
    });
  });

  it('B5: returns 400 when title is not a string', async () => {
    const request = createRequest({
      title: 123,
      body: 'Test Body',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: 'Both title and body are required',
    });
  });

  it('B5: returns 400 when body is not a string', async () => {
    const request = createRequest({
      title: 'Test Title',
      body: null,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: 'Both title and body are required',
    });
  });

  it('B5: returns 400 when request body is invalid JSON', async () => {
    const request = new Request(
      'https://example.com/api/articles/123/tags/suggest',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{',
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: 'Invalid request body',
    });
  });

  // ===========================================================================
  // B6: Non-POST method
  // ===========================================================================

  it('B6: returns 405 for GET method', async () => {
    const request = new Request(
      'https://example.com/api/articles/123/tags/suggest',
      {
        method: 'GET',
      }
    );

    // Type assertion needed since we're only exporting POST
    const response = await POST(request);

    expect(response.status).toBe(405);
    const data = await response.json();
    expect(data).toEqual({
      error: 'Method not allowed',
    });
  });
});
