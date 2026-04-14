import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser(nextPath = "/dashboard") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}
