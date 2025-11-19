import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from './env';

export type SupabaseClientOptions = {
  fetch?: typeof fetch;
};

export type SupabaseRequestCookies = {
  getAll(): Array<{ name: string; value: string }>;
};

export type SupabaseRequestContext = {
  cookies?: SupabaseRequestCookies;
  headers?: HeadersInit;
};

/**
 * Creates a Supabase client with the anonymous/publishable key.
 * Use this for unauthenticated or client-side operations.
 */
export const createSupabaseAnonClient = (
  options?: SupabaseClientOptions,
): SupabaseClient => {
  return createClient(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        ...(options?.fetch && { fetch: options.fetch }),
      },
    },
  );
};

/**
 * Creates a Supabase client with the service role key.
 * Use this for server-side admin operations that bypass RLS.
 * NEVER expose this client to the browser.
 */
export const createSupabaseServiceRoleClient = (
  options?: SupabaseClientOptions,
): SupabaseClient => {
  return createClient(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_SECRET_KEY,
    {
      global: {
        ...(options?.fetch && { fetch: options.fetch }),
      },
    },
  );
};

/**
 * Creates a Supabase client that forwards auth context from the request.
 * Use this in API routes/server components where user identity matters.
 */
export const createSupabaseAuthClient = (
  context: SupabaseRequestContext,
  options?: SupabaseClientOptions,
): SupabaseClient => {
  if (!context) {
    throw new Error('Auth context is required to create an authenticated Supabase client');
  }

  const headers: Record<string, string> = {};

  // Extract cookies and format as cookie header
  if (context.cookies) {
    const cookies = context.cookies.getAll();
    if (cookies.length > 0) {
      headers.cookie = cookies
        .map(({ name, value }) => `${name}=${value}`)
        .join('; ');
    }
  }

  // Forward request headers (Authorization, tracing, etc.)
  if (context.headers) {
    if (context.headers instanceof Headers) {
      context.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    } else if (Array.isArray(context.headers)) {
      for (const [key, value] of context.headers) {
        headers[key.toLowerCase()] = value;
      }
    } else {
      for (const [key, value] of Object.entries(context.headers)) {
        headers[key.toLowerCase()] = value;
      }
    }
  }

  return createClient(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers,
        ...(options?.fetch && { fetch: options.fetch }),
      },
    },
  );
};
