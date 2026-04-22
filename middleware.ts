import { NextResponse, type NextRequest } from "next/server";

import { classifyRoute, shouldRedirectAuthenticatedUser } from "@/lib/auth-routing";
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
  if (!hasSupabaseEnv()) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  const { response, supabase } = createSupabaseMiddlewareClient(request);
  const user = await getSupabaseMiddlewareUser(request, supabase, response);
  const routeVisibility = classifyRoute(pathname);

  if (!user) {
    if (routeVisibility === "private-api") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

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
