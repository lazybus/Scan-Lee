import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/server";

const protectedPrefixes = ["/dashboard", "/document-types", "/documents"];
const protectedApiPrefixes = ["/api/document-types", "/api/documents", "/api/exports"];
const authRoutes = new Set(["/login", "/register"]);

function isDocumentFilePath(pathname: string) {
  return pathname.startsWith("/api/documents/") && pathname.endsWith("/file");
}

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isProtectedApiPath(pathname: string) {
  return protectedApiPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
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

  if (isDocumentFilePath(pathname)) {
    return NextResponse.next();
  }

  const { response, supabase } = createSupabaseMiddlewareClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", buildNextPath(request));
    return NextResponse.redirect(loginUrl);
  }

  if (!user && isProtectedApiPath(pathname)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user && authRoutes.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
