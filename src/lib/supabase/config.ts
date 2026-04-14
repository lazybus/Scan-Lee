const DEFAULT_SITE_URL = "http://localhost:3000";

function getSupabaseClientKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabaseClientKey());
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = getSupabaseClientKey();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url, publishableKey };
}

export function getSupabaseStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "scanlee-documents";
}

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
}
