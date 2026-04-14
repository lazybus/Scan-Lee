"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { AuthActionState } from "@/app/auth/action-state";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
});

const magicLinkSchema = z.object({
  email: z.email("Enter a valid email address.").trim(),
});

function normalizeNextPath(value: FormDataEntryValue | null) {
  const candidate = String(value ?? "").trim();

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/dashboard";
  }

  return candidate;
}

async function buildAuthRedirectUrl(nextPath: string) {
  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (host ? `${protocol}://${host}` : "http://localhost:3000");
  const callbackUrl = new URL("/auth/callback", origin);

  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}

export async function signInWithPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validatedFields = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      status: "error",
      fieldErrors: validatedFields.error.flatten().fieldErrors,
      message: "Enter a valid email and password.",
    };
  }

  const supabase = await createSupabaseServerActionClient();
  const nextPath = normalizeNextPath(formData.get("next"));
  const { error } = await supabase.auth.signInWithPassword(validatedFields.data);

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  redirect(nextPath);
}

export async function signUpWithPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validatedFields = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      status: "error",
      fieldErrors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted fields and try again.",
    };
  }

  const supabase = await createSupabaseServerActionClient();
  const nextPath = normalizeNextPath(formData.get("next"));
  const emailRedirectTo = await buildAuthRedirectUrl(nextPath);
  const { data, error } = await supabase.auth.signUp({
    email: validatedFields.data.email,
    password: validatedFields.data.password,
    options: {
      data: {
        display_name: validatedFields.data.name,
      },
      emailRedirectTo,
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  if (data.session) {
    redirect(nextPath);
  }

  return {
    status: "success",
    message: "Check your email to confirm your account, then sign in.",
  };
}

export async function sendMagicLinkAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validatedFields = magicLinkSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return {
      status: "error",
      fieldErrors: validatedFields.error.flatten().fieldErrors,
      message: "Enter a valid email address.",
    };
  }

  const supabase = await createSupabaseServerActionClient();
  const nextPath = normalizeNextPath(formData.get("next"));
  const emailRedirectTo = await buildAuthRedirectUrl(nextPath);
  const { error } = await supabase.auth.signInWithOtp({
    email: validatedFields.data.email,
    options: {
      emailRedirectTo,
      shouldCreateUser: false,
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "success",
    message: "Magic link sent. Open the email on this device to finish signing in.",
  };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerActionClient();
  await supabase.auth.signOut();
  redirect("/");
}
