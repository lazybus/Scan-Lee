"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  initialAuthActionState,
  type AuthActionState,
} from "@/app/auth/action-state";

type AuthFormProps = {
  mode: "login" | "register";
  action: (
    state: AuthActionState,
    payload: FormData,
  ) => Promise<AuthActionState>;
  magicLinkAction?: (
    state: AuthActionState,
    payload: FormData,
  ) => Promise<AuthActionState>;
  nextPath?: string;
  setupIncomplete?: boolean;
  initialMessage?: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="action-button w-full sm:w-auto" disabled={pending} type="submit">
      {pending ? "Working..." : label}
    </button>
  );
}

function MessageBlock({ state, fallbackMessage }: { state: AuthActionState; fallbackMessage?: string }) {
  const message = state.message || fallbackMessage;

  if (!message) {
    return null;
  }

  return (
    <div
      className="border-2 border-[var(--ink)] px-4 py-3 text-sm leading-6"
      style={{
        background:
          state.status === "error"
            ? "color-mix(in srgb, var(--danger) 18%, var(--panel-strong) 82%)"
            : "color-mix(in srgb, var(--success) 18%, var(--panel-strong) 82%)",
      }}
    >
      {message}
    </div>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) {
    return null;
  }

  return <p className="mt-2 text-sm text-[var(--danger)]">{errors[0]}</p>;
}

export function AuthForm({
  mode,
  action,
  magicLinkAction,
  nextPath = "/dashboard",
  setupIncomplete = false,
  initialMessage,
}: AuthFormProps) {
  const [state, formAction] = useActionState(action, initialAuthActionState);
  const [magicState, magicFormAction] = useActionState(
    magicLinkAction ?? (async () => initialAuthActionState),
    initialAuthActionState,
  );

  const isRegister = mode === "register";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="paper-panel p-8 sm:p-10">
        <p className="data-label">{isRegister ? "Create Account" : "Sign In"}</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          {isRegister ? "Create your Scanlee workspace" : "Enter your workspace"}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
          {isRegister
            ? "Create an account to keep document types, uploads, and exports scoped to your workspace."
            : "Use your email and password, or request a magic link to finish signing in without a password prompt on this device."}
        </p>

        <div className="mt-8 space-y-4">
          {setupIncomplete ? (
            <div className="border-2 border-[var(--ink)] bg-[var(--panel-strong)] px-4 py-3 text-sm leading-7 text-[var(--muted)]">
              Supabase environment variables are not configured yet. Set
              NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
              NEXT_PUBLIC_SITE_URL, and SUPABASE_STORAGE_BUCKET before using
              authentication.
            </div>
          ) : null}
          <MessageBlock state={state} fallbackMessage={initialMessage} />
        </div>

        <form action={formAction} className="mt-8 space-y-5">
          <input name="next" type="hidden" value={nextPath} />

          {isRegister ? (
            <div>
              <label className="data-label" htmlFor="name">
                Name
              </label>
              <input className="input-base mt-2" id="name" name="name" placeholder="Avery Chen" />
              <FieldError errors={state.fieldErrors?.name} />
            </div>
          ) : null}

          <div>
            <label className="data-label" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className="input-base mt-2"
              id="email"
              name="email"
              placeholder="name@company.com"
              type="email"
            />
            <FieldError errors={state.fieldErrors?.email} />
          </div>

          <div>
            <label className="data-label" htmlFor="password">
              Password
            </label>
            <input
              autoComplete={isRegister ? "new-password" : "current-password"}
              className="input-base mt-2"
              id="password"
              name="password"
              placeholder="At least 8 characters"
              type="password"
            />
            <FieldError errors={state.fieldErrors?.password} />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <SubmitButton label={isRegister ? "Create Account" : "Sign In"} />
            <p className="text-sm text-[var(--muted)]">
              {isRegister ? (
                <>
                  Already have an account? <Link className="underline decoration-[var(--accent)] underline-offset-4" href="/login">Sign in</Link>
                </>
              ) : (
                <>
                  Need an account? <Link className="underline decoration-[var(--accent)] underline-offset-4" href="/register">Register</Link>
                </>
              )}
            </p>
          </div>
        </form>
      </section>

      <section className="paper-panel p-8 sm:p-10">
        <p className="data-label">Access Model</p>
        <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
          <p>Each account gets a private workspace for uploads and document records.</p>
          <p>Cheque and invoice templates remain available to everyone as built-in defaults.</p>
          <p>Public user templates are intended to be duplicated before editing, not changed in place.</p>
        </div>

        {isRegister ? null : (
          <div className="mt-8 border-t-2 border-[var(--line)] pt-8">
            <p className="data-label">Magic Link</p>
            <MessageBlock state={magicState} />
            <form action={magicFormAction} className="mt-5 space-y-5">
              <input name="next" type="hidden" value={nextPath} />
              <div>
                <label className="data-label" htmlFor="magic-email">
                  Email
                </label>
                <input
                  autoComplete="email"
                  className="input-base mt-2"
                  id="magic-email"
                  name="email"
                  placeholder="name@company.com"
                  type="email"
                />
                <FieldError errors={magicState.fieldErrors?.email} />
              </div>
              <SubmitButton label="Send Magic Link" />
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
