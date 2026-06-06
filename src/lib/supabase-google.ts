"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const GLOBAL_KEY = "__asiaBotGoogleSupabase";

type GoogleSupabaseGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: SupabaseClient;
};

export function getGoogleSupabase() {
  const globalForSupabase = globalThis as GoogleSupabaseGlobal;
  if (globalForSupabase[GLOBAL_KEY]) return globalForSupabase[GLOBAL_KEY];

  globalForSupabase[GLOBAL_KEY] = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: "asia-bot-google-auth",
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );

  return globalForSupabase[GLOBAL_KEY];
}
