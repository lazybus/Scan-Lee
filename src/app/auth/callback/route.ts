import { NextResponse } from "next/server";

import { normalizeSafeNextPath } from "@/lib/security";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = normalizeSafeNextPath(url.searchParams.get("next"));
  const redirectUrl = new URL(nextPath, request.url);

  if (!hasSupabaseEnv()) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("message", "supabase-not-configured");
    return NextResponse.redirect(redirectUrl);
  }

  const code = url.searchParams.get("code");

  if (!code) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("message", "auth-code-missing");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createSupabaseRouteHandlerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("message", "auth-code-invalid");
  }

  return NextResponse.redirect(redirectUrl);
}
