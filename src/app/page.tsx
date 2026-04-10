import Link from "next/link";

import { getDashboardSummary } from "@/lib/documents";
import { listDocumentTypes } from "@/lib/document-types";

export const dynamic = "force-dynamic";

export default function Home() {
  const summary = getDashboardSummary();
  const documentTypes = listDocumentTypes();

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="paper-panel grid-rule p-8 sm:p-10">
        <p className="data-label">Local-First Capture Stack</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Turn photographed cheques and invoices into structured local records.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
          Scanlee keeps extraction on-device: photos live in your local file system,
          document definitions live in SQLite, and Ollama runs the vision model on the
          same machine. Review first, then export to CSV or XLSX.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link className="action-button" href="/documents">
            Start Capturing
          </Link>
          <Link className="secondary-button" href="/document-types">
            Configure Types
          </Link>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Document Types",
              value: summary.documentTypeCount,
              note: "Schema versions and prompts",
            },
            {
              label: "Stored Captures",
              value: summary.documentCount,
              note: "Original files remain local",
            },
            {
              label: "Extracted Records",
              value: summary.extractedCount,
              note: "Ready for export or review",
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
            <p className="data-label">Current Defaults</p>
            <h2 className="mt-3 text-2xl font-semibold">Seeded document types</h2>
          </div>
          <span className="status-pill" data-state="reviewed">
            SQLite Ready
          </span>
        </div>
        <div className="mt-6 space-y-4">
          {documentTypes.map((documentType) => (
            <article
              key={documentType.id}
              className="border-2 border-[var(--ink)] bg-[var(--panel-strong)] p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">{documentType.name}</h3>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {documentType.slug}
                  </p>
                </div>
                <span className="status-pill" data-state="uploaded">
                  {documentType.fields.length} fields
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {documentType.description}
              </p>
            </article>
          ))}
        </div>
        <div className="divider my-6" />
        <div className="space-y-3 text-sm leading-7 text-[var(--muted)]">
          <p>
            Configure each type with expected labels, aliases, and field kinds.
          </p>
          <p>
            Upload a photo, send it to the local vision model, review the output, and
            export the approved dataset.
          </p>
        </div>
      </section>
    </div>
  );
}
