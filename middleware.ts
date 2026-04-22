import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseEnv } from "@/lib/supabase/config";
import {
  createSupabaseMiddlewareClient,
  getSupabaseMiddlewareUser,
} from "@/lib/supabase/server";

const publicPaths = new Set([
  "/",
  "/about",
  "/acceptable-use",
  "/auth/callback",
  "/contact",
  "/cookies",
  "/data-processing",
  "/login",
  "/privacy",
  "/register",
  "/terms",
]);
const publicApiPaths = new Set(["/api/health/ai"]);
const authRoutes = new Set(["/login", "/register"]);

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isPublicPath(pathname: string) {
  return publicPaths.has(pathname);
}

function isPublicApiPath(pathname: string) {
  return publicApiPaths.has(pathname);
}

function buildNextPath(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  return `${pathname}${search}`;
}

export async function middleware(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  const { response, supabase } = createSupabaseMiddlewareClient(request);
  const user = await getSupabaseMiddlewareUser(request, supabase, response);

  if (!user) {
    if (isApiPath(pathname) && !isPublicApiPath(pathname)) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isPublicPath(pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", buildNextPath(request));
      return NextResponse.redirect(loginUrl);
    }
  }

  if (user && authRoutes.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
