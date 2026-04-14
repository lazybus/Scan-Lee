"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, publishableKey } = getSupabaseEnv();
  browserClient = createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}
