import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

function isSupabaseAuthCookieName(name: string) {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

function isRefreshTokenNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code === "refresh_token_not_found"
    : false;
}

export function createSupabaseMiddlewareClient(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  return { response, supabase };
}

export function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  const authCookies = request.cookies
    .getAll()
    .filter((cookie) => isSupabaseAuthCookieName(cookie.name));

  for (const cookie of authCookies) {
    response.cookies.delete(cookie.name);
  }
}

export async function getSupabaseMiddlewareUser(
  request: NextRequest,
  supabase: ReturnType<typeof createSupabaseMiddlewareClient>["supabase"],
  response: NextResponse,
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch (error) {
    if (isRefreshTokenNotFoundError(error)) {
      clearSupabaseAuthCookies(request, response);
      return null;
    }

    throw error;
  }
}

export async function createSupabaseServerComponentClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
}

export async function createSupabaseServerActionClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

export async function createSupabaseRouteHandlerClient() {
  return createSupabaseServerActionClient();
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerComponentClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch (error) {
    if (isRefreshTokenNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function requireUser(nextPath = "/dashboard") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}
