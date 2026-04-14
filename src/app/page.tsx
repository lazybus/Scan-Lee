import Link from "next/link";

import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = hasSupabaseEnv() ? await getCurrentUser().catch(() => null) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="paper-panel grid-rule p-8 sm:p-10">
        <p className="data-label">Shared Templates, Private Workspaces</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Extract cheque and invoice data into a secure account-based workspace.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
          Scanlee pairs local Ollama extraction with Supabase-backed accounts, private
          uploads, and reusable document templates. Each account keeps its own documents
          and schemas while shared starter templates remain available to duplicate.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link className="action-button" href={user ? "/dashboard" : "/register"}>
            {user ? "Open Dashboard" : "Create Account"}
          </Link>
          <Link className="secondary-button" href={user ? "/documents" : "/login"}>
            {user ? "Open Capture Queue" : "Log In"}
          </Link>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Secure Auth",
              value: "01",
              note: "Email/password and magic links",
            },
            {
              label: "Default Types",
              value: "02",
              note: "Cheque and invoice for every account",
            },
            {
              label: "Private Data",
              value: "03",
              note: "Per-user documents and templates",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border-2 border-[var(--ink)] bg-[var(--panel-strong)] p-5"
            >
              <p className="data-label">{item.label}</p>
              <p className="mt-3 text-4xl font-semibold">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="paper-panel p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="data-label">How It Works</p>
            <h2 className="mt-3 text-2xl font-semibold">Structured extraction without a shared inbox</h2>
          </div>
          <span className="status-pill" data-state={user ? "reviewed" : "uploaded"}>
            {user ? "Account Active" : "Public Entry"}
          </span>
        </div>
        <div className="mt-6 space-y-4">
          {[
            {
              title: "Account-scoped workspaces",
              detail:
                "Documents, exports, and custom templates stay attached to the signed-in user instead of a shared local workspace.",
            },
            {
              title: "Template sharing by duplication",
              detail:
                "Built-in and public templates are readable by everyone, but customization always happens in a private duplicated copy.",
            },
            {
              title: "Private file storage",
              detail:
                "Uploaded document images live in Supabase Storage while extraction still runs against your local Ollama model.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="border-2 border-[var(--ink)] bg-[var(--panel-strong)] p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                </div>
                <span className="status-pill" data-state="reviewed">
                  Live
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {item.detail}
              </p>
            </article>
          ))}
        </div>
        <div className="divider my-6" />
        <div className="space-y-3 text-sm leading-7 text-[var(--muted)]">
          <p>
            Create an account to unlock your private dashboard, upload queue, review flow,
            and export tools.
          </p>
          <p>
            Start from the built-in cheque and invoice templates or publish your own schema
            for other users to duplicate.
          </p>
        </div>
      </section>
    </div>
  );
}

