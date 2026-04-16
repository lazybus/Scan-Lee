import Link from "next/link";

import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = hasSupabaseEnv() ? await getCurrentUser().catch(() => null) : null;
  const primaryHref = user ? "/dashboard" : "/register";
  const primaryLabel = user ? "Open Dashboard" : "Create Account";
  const secondaryHref = user ? "/batches" : "/login";
  const secondaryLabel = user ? "Open Image Batches" : "Log In";

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="paper-panel grid-rule p-8 sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center gap-3">
            <p className="data-label">Private Document Extraction</p>
            <span className="status-pill" data-state="processing">
              Free beta
            </span>
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            Turn document images into reviewable, export-ready data in minutes.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">
            Upload photos or scans of invoices, cheques, and other business documents,
            let Scanlee extract the fields into the exact structure you need, review the
            results, and export clean data to CSV or Excel.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
            It is built to reduce manual entry, speed up repetitive admin work, and improve
            consistency while still keeping human review simple whenever you want to verify
            or correct extracted values.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link className="action-button" href={primaryHref}>
              {primaryLabel}
            </Link>
            <Link className="secondary-button" href={secondaryHref}>
              {secondaryLabel}
            </Link>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Batch Processing",
                value: "Multi-image",
                note: "Process many document images at once instead of one file at a time.",
              },
              {
                label: "Custom Formats",
                value: "Unlimited",
                note: "Create as many document type templates as your workflow requires.",
              },
              {
                label: "Human Review",
                value: "Built in",
                note: "Review and correct extracted data before it is exported downstream.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="border border-[var(--line-strong)] bg-[var(--panel-strong)] p-5"
              >
                <p className="data-label">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold sm:text-3xl">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="paper-panel p-6 sm:p-8">
            <p className="data-label">Three Steps</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
              A faster path from document image to business-ready export.
            </h2>
            <div className="mt-6 space-y-4">
              {[
                {
                  step: "01",
                  title: "Upload your document images",
                  detail:
                    "Capture or import the files you need to process from desktop or mobile into your private account workspace.",
                },
                {
                  step: "02",
                  title: "Process the batch with AI",
                  detail:
                    "Run extraction against the document type template that matches your workflow so fields are organized the way your business expects.",
                },
                {
                  step: "03",
                  title: "Review and export the data",
                  detail:
                    "Quickly check the results, make any corrections you need, and export reviewed records to CSV or Excel for the next system in your process.",
                },
              ].map((item) => (
                <article
                  key={item.step}
                  className="border border-[var(--line-strong)] bg-[var(--panel-strong)] p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="min-w-14 rounded-full border border-[var(--line-strong)] px-3 py-2 text-center font-mono text-xs font-medium tracking-[0.18em] text-[var(--accent-soft)]">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold sm:text-xl">{item.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.detail}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="paper-panel p-6 sm:p-8">
            <p className="data-label">Why Teams Use It</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                "Save hours on repetitive data entry.",
                "Improve consistency with structured templates.",
                "Handle cheques, invoices, and custom formats.",
                "Work comfortably from desktop or mobile.",
              ].map((item) => (
                <div
                  key={item}
                  className="border border-[var(--line-strong)] bg-[var(--panel-strong)] p-4 text-sm leading-7 text-[var(--muted)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="paper-panel p-8 sm:p-10">
          <p className="data-label">Built For Flexible Workflows</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Create the exact document template your process needs.
          </h2>
          <p className="mt-5 text-base leading-8 text-[var(--muted)] sm:text-lg">
            Define templates for invoices, cheques, receipts, statements, or any other
            structured paperwork you receive. Scanlee organizes extracted data against the
            template you choose so exports stay predictable and ready for the next tool in
            your business.
          </p>
          <div className="mt-8 space-y-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>Use one-off templates for edge cases or build a growing library for recurring document types.</p>
            <p>Unlimited document types means the system can adapt as your business processes expand.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              title: "Process full image batches",
              detail:
                "Upload multiple pages or multiple documents together and run them through extraction in one workflow to save substantial time.",
            },
            {
              title: "Review before export",
              detail:
                "Keep a human in the loop with a straightforward review step so corrections stay quick and data quality stays high.",
            },
            {
              title: "Private and secure accounts",
              detail:
                "Your files, templates, and extracted data stay inside your own account workspace rather than a shared inbox or public pool.",
            },
            {
              title: "Ready for downstream systems",
              detail:
                "Export reviewed results into CSV or Excel so the formatted output can slot into bookkeeping, ERP, or other operational systems.",
            },
          ].map((item) => (
            <article key={item.title} className="paper-panel p-6 sm:p-7">
              <p className="data-label">Feature</p>
              <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="paper-panel p-8 sm:p-10 lg:p-12">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="data-label">Beta Access</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start using Scanlee to cut manual entry time without giving up control.
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">
              Scanlee is currently a free SaaS beta. It is designed to be easy to use,
              mobile friendly, and practical for teams that want faster document handling
              with an efficient review step before export.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 lg:justify-end">
            <Link className="action-button" href={primaryHref}>
              {primaryLabel}
            </Link>
            <Link className="secondary-button" href={secondaryHref}>
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

