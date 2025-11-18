import { afterAll, expect, test, vi } from 'vitest';

const QUICKSTART_ENV = {
  NEXT_PUBLIC_BASE_URL: 'https://local.dev',
  SUPABASE_URL: 'https://supabase.dev',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE: 'service',
  S3_DRAFT_BUCKET: 'drafts-bucket',
  AWS_REGION: 'ap-northeast-1',
  UPSTASH_REDIS_REST_URL: 'https://redis.example',
  UPSTASH_REDIS_REST_TOKEN: 'token',
  OPENSEARCH_ENDPOINT: 'https://opensearch.example',
  SES_SENDER: 'notify@example.com',
};

const originalEnv = { ...process.env };

afterAll(() => {
  process.env = originalEnv;
});

const loadEnvModule = async (
  overrides: Partial<typeof QUICKSTART_ENV> = {},
): Promise<typeof import('../lib/env')> => {
  vi.resetModules();
  process.env = { ...originalEnv, ...QUICKSTART_ENV, ...overrides } as NodeJS.ProcessEnv;
  return import('../lib/env');
};

test('env module loads with valid configuration', async () => {
  await expect(loadEnvModule()).resolves.toMatchObject({
    serverEnv: expect.objectContaining({
      SUPABASE_URL: QUICKSTART_ENV.SUPABASE_URL,
    }),
    publicEnv: expect.objectContaining({
      NEXT_PUBLIC_BASE_URL: QUICKSTART_ENV.NEXT_PUBLIC_BASE_URL,
    }),
  });
});

test('env module throws when required variable missing/invalid', async () => {
  await expect(loadEnvModule({ SUPABASE_URL: '' })).rejects.toThrow(/SUPABASE_URL/);
});
