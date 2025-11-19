import { afterAll, describe, expect, it, vi } from 'vitest';

const MOCK_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key-test',
  SUPABASE_SECRET_KEY: 'sercret-key-test',
};

vi.mock('../env', () => ({
  serverEnv: { ...MOCK_ENV },
}));

const mockCreateClient = vi.fn(() => ({
  auth: {
    getSession: vi.fn(),
  },
}));

vi.mock(
  '@supabase/supabase-js',
  () => {
    return {
      createClient: mockCreateClient,
    };
  },
  { virtual: true },
);

type SupabaseModule = typeof import('../supabase');

type CreateClientMock = ReturnType<typeof vi.fn>;

const originalEnv = { ...process.env };

afterAll(() => {
  process.env = originalEnv;
});

const swallowErrors = <T>(fn: () => T): T | undefined => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

const normalizeHeaders = (input: unknown): Record<string, string> => {
  if (!input) {
    return {};
  }

  const normalized: Record<string, string> = {};

  if (input instanceof Headers) {
    input.forEach((value, key) => {
      normalized[key.toLowerCase()] = value;
    });
    return normalized;
  }

  if (Array.isArray(input)) {
    for (const [key, value] of input as Array<[string, string]>) {
      normalized[key.toLowerCase()] = value;
    }
    return normalized;
  }

  if (typeof input === 'object') {
    for (const [key, value] of Object.entries(input as Record<string, string>)) {
      normalized[key.toLowerCase()] = value;
    }
    return normalized;
  }

  return normalized;
};

const importSupabase = async (): Promise<{
  module: SupabaseModule;
  createClientMock: CreateClientMock;
}> => {
  vi.resetModules();
  mockCreateClient.mockClear();
  const module = await import('../supabase');
  return { module, createClientMock: mockCreateClient };
};

describe('supabase client factory', () => {
  it('creates anon client with anon key', async () => {
    const { module, createClientMock } = await importSupabase();
    swallowErrors(() => module.createSupabaseAnonClient());
    const [url, key] = createClientMock.mock.calls.at(-1) ?? [];
    expect(url).toBe(MOCK_ENV.SUPABASE_URL);
    expect(key).toBe(MOCK_ENV.SUPABASE_PUBLISHABLE_KEY);
  });

  it('creates service role client with elevated key', async () => {
    const { module, createClientMock } = await importSupabase();
    swallowErrors(() => module.createSupabaseServiceRoleClient());
    const [url, key] = createClientMock.mock.calls.at(-1) ?? [];
    expect(url).toBe(MOCK_ENV.SUPABASE_URL);
    expect(key).toBe(MOCK_ENV.SUPABASE_SECRET_KEY);
  });

  it('passes custom fetch options through to Supabase', async () => {
    const { module, createClientMock } = await importSupabase();
    const customFetch = vi.fn();
    swallowErrors(() => module.createSupabaseAnonClient({ fetch: customFetch as unknown as typeof fetch }));
    const options = createClientMock.mock.calls.at(-1)?.[2] as Record<string, unknown>;
    expect(options?.global).toBeDefined();
    expect(options?.global).toMatchObject({
      fetch: customFetch,
    });
  });

  it('injects cookies and headers into auth-aware client', async () => {
    const { module, createClientMock } = await importSupabase();
    const cookieStore = {
      getAll: () => [
        { name: 'sb-access-token', value: 'access-token' },
        { name: 'sb-refresh-token', value: 'refresh-token' },
      ],
    };
    const headers = new Headers({
      Authorization: 'Bearer supa-token',
      'X-Trace-Id': 'trace-123',
    });

    swallowErrors(() =>
      module.createSupabaseAuthClient({
        cookies: cookieStore,
        headers,
      }),
    );

    const options = createClientMock.mock.calls.at(-1)?.[2] as Record<string, unknown>;
    const headersRecord = normalizeHeaders(options?.global && (options.global as { headers?: unknown }).headers);

    expect(headersRecord).toMatchObject({
      cookie: 'sb-access-token=access-token; sb-refresh-token=refresh-token',
      authorization: 'Bearer supa-token',
      'x-trace-id': 'trace-123',
    });
    const [url, key] = createClientMock.mock.calls.at(-1) ?? [];
    expect(url).toBe(MOCK_ENV.SUPABASE_URL);
    expect(key).toBe(MOCK_ENV.SUPABASE_PUBLISHABLE_KEY);
  });

  it('treats missing cookies/headers as unauthenticated', async () => {
    const { module, createClientMock } = await importSupabase();
    swallowErrors(() =>
      module.createSupabaseAuthClient({
        cookies: {
          getAll: () => [],
        },
        headers: undefined,
      }),
    );

    const options = createClientMock.mock.calls.at(-1)?.[2] as Record<string, unknown>;
    const headersRecord = normalizeHeaders(options?.global && (options.global as { headers?: unknown }).headers);

    expect(headersRecord.cookie).toBeUndefined();
    expect(headersRecord.authorization).toBeUndefined();
  });

  it('throws if auth-aware helper is invoked without context', async () => {
    const { module } = await importSupabase();
    expect(() => module.createSupabaseAuthClient(undefined as unknown as never)).toThrow(/auth/i);
  });

  it('never leaks service role key through auth-aware helpers', async () => {
    const { module, createClientMock } = await importSupabase();
    swallowErrors(() =>
      module.createSupabaseAuthClient({
        cookies: {
          getAll: () => [],
        },
        headers: new Headers(),
      }),
    );

    const [, key] = createClientMock.mock.calls.at(-1) ?? [];
    expect(key).toBe(MOCK_ENV.SUPABASE_PUBLISHABLE_KEY);
  });

  it('ignores direct process.env mutations by relying on serverEnv', async () => {
    const overrideEnv = {
      SUPABASE_URL: 'https://override.supabase.dev',
      SUPABASE_PUBLISHABLE_KEY: 'override-anon',
      SUPABASE_SECRET_KEY: 'override-service',
    };

    const previousEnv = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    };

    process.env.SUPABASE_URL = overrideEnv.SUPABASE_URL;
    process.env.SUPABASE_PUBLISHABLE_KEY = overrideEnv.SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SECRET_KEY = overrideEnv.SUPABASE_SECRET_KEY;

    const { module, createClientMock } = await importSupabase();
    swallowErrors(() => module.createSupabaseAnonClient());

    const [url, key] = createClientMock.mock.calls.at(-1) ?? [];
    expect(url).toBe(MOCK_ENV.SUPABASE_URL);
    expect(key).toBe(MOCK_ENV.SUPABASE_PUBLISHABLE_KEY);

    process.env.SUPABASE_URL = previousEnv.SUPABASE_URL;
    process.env.SUPABASE_PUBLISHABLE_KEY = previousEnv.SUPABASE_PUBLISHABLE_KEY;
    process.env.SUPABASE_SECRET_KEY = previousEnv.SUPABASE_SECRET_KEY;
  });
});
