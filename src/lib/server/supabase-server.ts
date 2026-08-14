import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Single service-role Supabase client for server code.
 *
 * Before this existed, ~90 API routes each built their own client at module
 * scope with `createClient(URL!, SERVICE_ROLE_KEY!)`. That pattern crashes at
 * import time with an unhelpful error when an env var is missing, and it makes
 * the service-role key impossible to audit. Route handlers should call
 * `getServiceClient()` instead; migrate routes as you touch them.
 *
 * This module is `server-only`: importing it from a client component is a
 * build error, which is the guardrail that keeps the service-role key off the
 * browser.
 */
let cached: SupabaseClient<Database> | null = null;

export function getServiceClient(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set. See .env.example."
    );
  }

  cached = createClient<Database>(url, serviceRoleKey, {
    auth: {
      // Service-role calls are stateless; never persist or refresh a session.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
