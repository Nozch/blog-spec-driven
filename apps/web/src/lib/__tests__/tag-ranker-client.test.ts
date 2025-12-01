import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import {
  HttpTagRankerClient,
  TagRankerRequestError,
  type TagSuggestionEvent,
} from '../tag-ranker-client';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

describe('HttpTagRankerClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  const sampleEvent: TagSuggestionEvent = {
    content: 'Example title\n\nExample body',
    minScore: 0.4,
    maxTags: 3,
  };

  function mockJsonResponse(
    body: any,
    status = 200
  ): { status: number; json: () => Promise<any>; text: () => Promise<string> } {
    return {
      status,
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    };
  }

  it('A1: returns success payload on 200', async () => {
    const endpoint = 'https://tag-ranker.example.com/suggest';
    const successBody = { success: true, tags: [{ tag: 'ai', score: 0.9 }] };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(successBody, 200));

    const client = new HttpTagRankerClient(endpoint);
    const result = await client.suggest(sampleEvent);

    expect(result).toEqual(successBody);
    expect(fetchMock).toHaveBeenCalledWith(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEvent),
    });
  });

  it('A2: returns failure payload when success false at 200', async () => {
    const failureBody = { success: false, error: 'Validation failed' };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(failureBody, 200));

    const client = new HttpTagRankerClient('https://service');
    const result = await client.suggest(sampleEvent);

    expect(result).toEqual(failureBody);
  });

  it('A3: returns failure payload when success false at 400', async () => {
    const failureBody = { success: false, error: 'Bad content' };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(failureBody, 400));

    const client = new HttpTagRankerClient('https://service');
    const result = await client.suggest(sampleEvent);

    expect(result).toEqual(failureBody);
  });

  it('A4: throws on unexpected status', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 502,
      json: vi.fn(),
      text: vi.fn().mockResolvedValue('bad gateway'),
    });

    const client = new HttpTagRankerClient('https://service');

    await expect(client.suggest(sampleEvent)).rejects.toMatchObject({
      status: 502,
      bodyText: 'bad gateway',
    });
  });

  it('A5: throws when JSON parsing fails', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
      text: vi.fn().mockResolvedValue('invalid'),
    });

    const client = new HttpTagRankerClient('https://service');

    await expect(client.suggest(sampleEvent)).rejects.toBeInstanceOf(
      TagRankerRequestError
    );
  });

  it('A6: throws when fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const client = new HttpTagRankerClient('https://service');

    await expect(client.suggest(sampleEvent)).rejects.toBeInstanceOf(
      TagRankerRequestError
    );
  });

  it('A7: resolves endpoint from constructor or env', async () => {
    const explicitEndpoint = 'https://explicit-endpoint';
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, tags: [] }));

    const explicitClient = new HttpTagRankerClient(explicitEndpoint);
    await explicitClient.suggest(sampleEvent);
    expect(fetchMock).toHaveBeenCalledWith(
      explicitEndpoint,
      expect.any(Object)
    );

    const envEndpoint = 'https://env-endpoint';
    process.env.TAG_RANKER_ENDPOINT = envEndpoint;
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, tags: [] }));

    const envClient = new HttpTagRankerClient();
    await envClient.suggest(sampleEvent);
    expect(fetchMock).toHaveBeenCalledWith(envEndpoint, expect.any(Object));
  });
});
