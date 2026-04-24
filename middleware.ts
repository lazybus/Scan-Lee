import { NextResponse, type NextRequest } from "next/server";

import {
  classifyMissingSupabaseBehavior,
  classifyRoute,
  shouldRedirectAuthenticatedUser,
} from "@/lib/auth-routing";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import {
  createSupabaseMiddlewareClient,
  getSupabaseMiddlewareUser,
} from "@/lib/supabase/server";

function buildNextPath(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  return `${pathname}${search}`;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const routeVisibility = classifyRoute(pathname);

  if (!hasSupabaseEnv()) {
    const missingSupabaseBehavior = classifyMissingSupabaseBehavior(pathname);

    if (missingSupabaseBehavior === "deny-api") {
      return NextResponse.json({ error: "Authentication is unavailable." }, { status: 503 });
    }

    if (missingSupabaseBehavior === "redirect-login") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("message", "supabase-not-configured");
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  if (routeVisibility === "private-api" || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const { response, supabase } = createSupabaseMiddlewareClient(request);
  const user = await getSupabaseMiddlewareUser(request, supabase, response);

  if (!user) {
    if (routeVisibility === "private-page") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", buildNextPath(request));
      return NextResponse.redirect(loginUrl);
    }
  }

  if (user && shouldRedirectAuthenticatedUser(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
