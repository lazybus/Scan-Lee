import type { Metadata } from "next";

import { ContentPageShell } from "@/components/content-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service | Scanlee",
  description: "First-draft terms of service for using Scanlee to upload, extract, review, and export document data.",
};

export default function TermsPage() {
  return (
    <ContentPageShell
      eyebrow="Legal"
      title="Terms of Service"
      lead="These draft terms describe the baseline rules for accessing and using Scanlee in its current product form."
    >
      <section className="content-page-section paper-panel">
        <h2>Use of the service</h2>
        <p>
          Scanlee provides document-type templates, file upload, AI-assisted extraction, review tooling, and export features.
          You may use the service only for lawful business or administrative workflows and only for content you are authorized
          to process.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Account and workspace security</h2>
        <p>
          You are responsible for protecting your login credentials, controlling who can access your workspace, and reviewing
          document templates and exports created under your account. If you believe your workspace has been accessed without
          authorization, notify the deployment operator promptly.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Extraction results and human review</h2>
        <p>
          Scanlee uses AI models to extract structured information from documents, but those results are not guaranteed to be
          complete, accurate, or fit for any regulated workflow without review. You agree to validate extracted data before relying
          on it for payments, tax, audit, compliance, or legal decisions.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Availability and changes</h2>
        <p>
          The service may change over time, including supported models, templates, integrations, limits, and export behavior.
          Features may be added, modified, suspended, or removed to maintain security, stability, or product direction.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Prohibited conduct</h2>
        <ul>
          <li>Do not upload unlawful, malicious, or rights-infringing content.</li>
          <li>Do not attempt to bypass workspace boundaries, quotas, or access controls.</li>
          <li>Do not use Scanlee to generate misleading records or falsified business documentation.</li>
        </ul>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Disclaimers</h2>
        <p>
          This draft does not create warranties about uninterrupted access, model availability, error-free extraction, regulatory
          compliance, or fitness for a particular purpose. Unless different written terms apply to your deployment, Scanlee is
          provided on an as-available basis.
        </p>
      </section>
    </ContentPageShell>
  );
}