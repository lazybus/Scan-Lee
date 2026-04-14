import Link from "next/link";

import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="paper-panel p-8 sm:p-10">
        <p className="data-label">Authenticated Workspace</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Welcome back{user.email ? `, ${user.email}` : ""}.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
          This dashboard is the entry point for your document queue, extraction reviews,
          exports, and reusable templates. Your workspace stays scoped to your account,
          while public and built-in templates remain available as read-only starting points.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link className="action-button" href="/documents">
            Open Documents
          </Link>
          <Link className="secondary-button" href="/document-types">
            Manage Document Types
          </Link>
        </div>
      </section>

      <section className="paper-panel p-6 sm:p-8">
        <div>
          <p className="data-label">Workspace Guide</p>
          <h2 className="mt-3 text-2xl font-semibold">What you can do from here</h2>
        </div>
        <div className="mt-6 space-y-4">
          {[
            "Upload document images into your private capture queue and run extraction through Ollama.",
            "Create private templates or publish reusable schemas that other users can duplicate.",
            "Review extracted values before export and keep your saved field order aligned with your workflow.",
            "Use the built-in cheque and invoice defaults when you need a starting point immediately.",
          ].map((item) => (
            <article key={item} className="border-2 border-[var(--ink)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm leading-7 text-[var(--muted)]">{item}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
