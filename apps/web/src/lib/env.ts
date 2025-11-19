import { ZodError, z } from 'zod';

/**
 * Environment configuration for T010.
 * The spec references `apps/web/lib/env.ts`, but Next.js maps `@/*` to `apps/web/src`
 * so the module lives here under `src/lib` while still fulfilling the spec task.
 * Every variable defined below is sourced from specs/001-sample/quickstart.md.
 */

const publicEnvSchema = z.object({
  NEXT_PUBLIC_BASE_URL: z
    .string()
    .url({ message: 'NEXT_PUBLIC_BASE_URL must be a valid URL (see quickstart.md)' }),
});

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL (see quickstart.md)' }),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1, { message: 'SUPABASE_PUBLISHABLE_KEY is required' }),
  SUPABASE_SECRET_KEY: z.string().min(1, { message: 'SUPABASE_SECRET_KEY is required' }),
  S3_DRAFT_BUCKET: z.string().min(1, { message: 'S3_DRAFT_BUCKET is required' }),
  AWS_REGION: z.string().min(1, { message: 'AWS_REGION is required' }),
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url({ message: 'UPSTASH_REDIS_REST_URL must be a valid URL' }),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, { message: 'UPSTASH_REDIS_REST_TOKEN is required' }),
  OPENSEARCH_ENDPOINT: z.string().url({ message: 'OPENSEARCH_ENDPOINT must be a valid URL' }),
  SES_SENDER: z.string().email({ message: 'SES_SENDER must be a valid email address' }),
});

const envSchema = publicEnvSchema.merge(serverEnvSchema);

type Env = z.infer<typeof envSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

const QUICKSTART_PATH = 'specs/001-sample/quickstart.md';

const formatIssues = (error: ZodError): string => {
  const issueLines = error.issues.map((issue) => {
    const key = issue.path.join('.') || '(root)';
    return `- ${key}: ${issue.message}`;
  });
  return [
    'Environment validation failed while loading @/lib/env:',
    ...issueLines,
    `Refer to ${QUICKSTART_PATH} for the required keys and update it alongside env.ts.`,
  ].join('\n');
};

const loadEnv = (): Env => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(formatIssues(error));
    }
    throw error;
  }
};

const env = loadEnv();

export const publicEnv: PublicEnv = {
  NEXT_PUBLIC_BASE_URL: env.NEXT_PUBLIC_BASE_URL,
};

export const serverEnv: ServerEnv = {
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  S3_DRAFT_BUCKET: env.S3_DRAFT_BUCKET,
  AWS_REGION: env.AWS_REGION,
  UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
  OPENSEARCH_ENDPOINT: env.OPENSEARCH_ENDPOINT,
  SES_SENDER: env.SES_SENDER,
};
