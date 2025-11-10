import { randomUUID } from 'node:crypto';

type PostHandler = (request: Request) => Promise<Response>;

const routeModuleSpecifier: string = '../../app/api/articles/route';

async function loadPostHandler(): Promise<PostHandler> {
  try {
    const module = (await import(routeModuleSpecifier)) as { POST?: PostHandler };
    if (typeof module.POST === 'function') {
      return module.POST;
    }
  } catch {
    // fall through to not implemented handler
  }
  return async () => new Response('Not Implemented', { status: 501 });
}

async function invokePost(body: Record<string, unknown>): Promise<Response> {
  const handler = await loadPostHandler();
  const request = new Request('http://localhost/api/articles', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handler(request);
}

function buildValidPayload() {
  return {
    title: `Draft ${randomUUID()}`,
    category: 'tech',
    bodyMdx: '# Hello world',
    bodyTipTap: { type: 'doc', content: [] },
    tags: ['nextjs', 'testing'],
    appearance: { fontSize: 16, leftPadding: 24 },
    status: 'draft',
    scheduledTimeJst: null,
  };
}

const expectClientError = (response: Response) => {
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(500);
};

describe('POST /api/articles contract', () => {
  it('returns 201 with ArticleResponse shape for valid draft', async () => {
    const response = await invokePost(buildValidPayload());

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(typeof json.articleId).toBe('string');
    expect(json.status).toBe('draft');
    expect(typeof json.draftUrl).toBe('string');
    expect(json.scheduledTimeJst === null || typeof json.scheduledTimeJst === 'string').toBe(true);
  });

  it('rejects payloads missing required ArticleComposeRequest fields', async () => {
    const { title, ...rest } = buildValidPayload();
    const response = await invokePost(rest);

    expectClientError(response);
    const json = await response.json();
    expect(json.error || json.message).toBeDefined();
  });

  it('rejects scheduled drafts with past scheduledTimeJst', async () => {
    const payload = {
      ...buildValidPayload(),
      status: 'scheduled',
      scheduledTimeJst: new Date(Date.now() - 60_000).toISOString(),
    };
    const response = await invokePost(payload);

    expectClientError(response);
    const json = await response.json();
    expect(json.error || json.message).toContain('scheduledTimeJst');
  });

  it('rejects appearance outside allowed ranges', async () => {
    const payload = {
      ...buildValidPayload(),
      appearance: { fontSize: 10, leftPadding: 200 },
    };
    const response = await invokePost(payload);

    expectClientError(response);
    const json = await response.json();
    expect(json.error || json.message).toContain('appearance');
  });
});
