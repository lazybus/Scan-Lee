import type { Metadata } from "next";

import { ContentPageShell } from "@/components/content-page-shell";

export const metadata: Metadata = {
  title: "Data Processing and AI Use | Scanlee",
  description: "First-draft explanation of how Scanlee uses storage, extraction providers, and review workflows to process uploaded documents.",
};

export default function DataProcessingPage() {
  return (
    <ContentPageShell
      eyebrow="Processing"
      title="Data Processing and AI Use"
      lead="This page gives a product-specific overview of how Scanlee moves document data through storage, extraction, review, and export."
    >
      <section className="content-page-section paper-panel">
        <h2>Processing flow</h2>
        <p>
          A typical Scanlee workflow starts when a user uploads a photographed or scanned document into a private workspace.
          The app stores the file, associates it with a document type, sends the file and prompt instructions to the configured
          model provider, normalizes the returned fields, and makes the result available for review before export.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Processors and sub-processors</h2>
        <p>
          Depending on deployment settings, Scanlee may rely on Supabase for authentication, database, and file storage; Ollama
          for local inference; and Google AI Studio for remote model inference. The exact set of providers depends on how your
          operator configures the environment.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Human-in-the-loop controls</h2>
        <p>
          Scanlee is designed to support a review stage rather than direct blind automation. Users can inspect extracted fields,
          correct mistakes, and then export the final data set. That review step is a core safeguard because AI outputs may still
          contain omissions, hallucinations, or formatting errors.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Security boundaries</h2>
        <p>
          The app aims to isolate workspaces and keep private uploads scoped to the authenticated account. Those protections depend
          on correct infrastructure setup, credential management, storage policies, and model-provider configuration by the deployment
          operator.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>What this draft does not guarantee</h2>
        <p>
          This page is an implementation summary, not a contractual data processing agreement. It does not guarantee residency,
          retention windows, breach notification timelines, or compliance status. If you need those commitments, they should be
          documented separately by the operator of the deployment you use.
        </p>
      </section>
    </ContentPageShell>
  );
}