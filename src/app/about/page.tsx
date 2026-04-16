import type { Metadata } from "next";

import { ContentPageShell } from "@/components/content-page-shell";

export const metadata: Metadata = {
  title: "About | Scanlee",
  description: "Overview of Scanlee and its document extraction workflow.",
};

export default function AboutPage() {
  return (
    <ContentPageShell
      eyebrow="About"
      title="What Scanlee is built for"
      lead="Scanlee is a document extraction workspace for turning photographed business documents into structured, reviewable records."
    >
      <section className="content-page-section paper-panel">
        <h2>Core workflow</h2>
        <p>
          Users create or duplicate a document type, upload files into a private workspace, run extraction, review the parsed fields,
          and export approved results to CSV or XLSX. The product is designed for repeatable operational workflows rather than one-off
          prompt experiments.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Flexible model backends</h2>
        <p>
          Scanlee can operate with local models through Ollama or remote models configured through Google AI Studio. That gives teams
          a path to choose between local control and hosted model access based on their deployment needs.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Why review matters</h2>
        <p>
          The system is built around review, not blind trust in model output. Extraction helps accelerate data entry and document
          handling, but the final record should still be checked by someone who understands the underlying document.
        </p>
      </section>
    </ContentPageShell>
  );
}