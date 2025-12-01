import { NextRequest, NextResponse } from 'next/server';

import {
  HttpTagRankerClient,
  TagRankerRequestError,
  type TagSuggestionEvent,
} from '@/lib/tag-ranker-client';

// Create a module-level instance of the client
const tagRankerClient = new HttpTagRankerClient();

export async function POST(request: NextRequest) {
  // Check method (Next.js route handlers only call POST for POST requests,
  // but we'll handle this explicitly as per requirements)
  if (request.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    // Parse and validate request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { title, body: articleBody, minScore, maxTags } = body;

    // Validate required fields
    if (typeof title !== 'string' || typeof articleBody !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Both title and body are required' },
        { status: 400 }
      );
    }

    // Build the TagSuggestionEvent
    const event: TagSuggestionEvent = {
      content: `${title}\n\n${articleBody}`,
    };

    // Only include optional parameters if provided
    if (minScore !== undefined) {
      event.minScore = minScore;
    }
    if (maxTags !== undefined) {
      event.maxTags = maxTags;
    }

    // Call the tag ranker service
    const result = await tagRankerClient.suggest(event);

    // Map response based on success flag
    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    // Handle TagRankerRequestError (service unavailable)
    if (error instanceof TagRankerRequestError) {
      return NextResponse.json(
        { success: false, error: 'Tag suggestion service unavailable.' },
        { status: 502 }
      );
    }

    // Re-throw unexpected errors
    throw error;
  }
}
