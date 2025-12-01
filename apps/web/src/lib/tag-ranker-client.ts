export interface TagSuggestionEvent {
  content: string;
  minScore?: number;
  maxTags?: number;
}

export type TagSuggestionResponse =
  | { success: true; tags: { tag: string; score: number }[]; message?: string }
  | { success: false; error: string; message?: string };

export interface TagRankerClient {
  suggest(event: TagSuggestionEvent): Promise<TagSuggestionResponse>;
}

export class TagRankerRequestError extends Error {
  constructor(
    message: string,
    public status?: number,
    public bodyText?: string
  ) {
    super(message);
    this.name = 'TagRankerRequestError';
  }
}

export class HttpTagRankerClient implements TagRankerClient {
  private readonly endpoint: string;

  constructor(endpoint?: string) {
    const resolved = endpoint ?? process.env.TAG_RANKER_ENDPOINT;
    if (!resolved) {
      throw new Error('TAG_RANKER_ENDPOINT is not configured');
    }
    this.endpoint = resolved;
  }

  async suggest(event: TagSuggestionEvent): Promise<TagSuggestionResponse> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (response.status === 200 || response.status === 400) {
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new TagRankerRequestError(
            'Failed to parse tag ranker response JSON'
          );
        }

        if (
          payload &&
          typeof (payload as Record<string, unknown>).success === 'boolean'
        ) {
          return payload as TagSuggestionResponse;
        }

        throw new TagRankerRequestError(
          'Tag ranker response missing success flag'
        );
      }

      const bodyText = await safeReadText(response);
      throw new TagRankerRequestError(
        `Tag ranker request failed with status ${response.status}`,
        response.status,
        bodyText
      );
    } catch (error) {
      if (error instanceof TagRankerRequestError) {
        throw error;
      }

      throw new TagRankerRequestError('Tag ranker service unreachable.');
    }
  }
}

async function safeReadText(response: {
  text?: () => Promise<string>;
}): Promise<string | undefined> {
  if (typeof response.text !== 'function') {
    return undefined;
  }

  try {
    return await response.text();
  } catch {
    return undefined;
  }
}
