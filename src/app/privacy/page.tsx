import type { Metadata } from "next";

import { ContentPageShell } from "@/components/content-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Scanlee",
  description: "First-draft privacy policy for Scanlee document capture, extraction, review, and export workflows.",
};

export default function PrivacyPage() {
  return (
    <ContentPageShell
      eyebrow="Privacy"
      title="Privacy Policy"
      lead="This first draft explains how Scanlee handles account data, uploaded files, extraction output, and service telemetry based on the product as it exists today."
    >
      <section className="content-page-section paper-panel">
        <h2>What Scanlee collects</h2>
        <p>
          Scanlee is built to process photographed or scanned business documents inside a private, account-scoped workspace.
          The service may store account identifiers, authentication details supplied through Supabase, document metadata,
          uploaded files, extraction results, review changes, and export history needed to operate the product.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>How information is used</h2>
        <p>
          The information you provide is used to let you upload documents, run extraction against configured AI providers,
          review parsed results, duplicate document types, and export structured records to CSV. We also use
          configuration and diagnostic data to keep the app available, investigate failures, and improve extraction quality.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>AI processing</h2>
        <p>
          Scanlee supports both local model execution through Ollama and remote model execution through Google AI Studio.
          When a remote provider is configured, document content and prompts required for extraction may be sent to that provider.
          When a local provider is configured, processing may stay within infrastructure controlled by the deployment operator.
        </p>
        <p>
          Model output can be inaccurate or incomplete. Scanlee is designed with a review step so users can verify and correct
          extracted values before using or exporting them.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Storage and access</h2>
        <p>
          Scanlee uses Supabase-backed authentication, database, and storage services. Uploaded files and extracted records are
          intended to remain isolated to the account or workspace authorized to access them. Access controls depend on the correct
          deployment and configuration of the environment hosting the app.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Retention and deletion</h2>
        <p>
          This draft does not promise a fixed retention period. Documents, extraction results, and related records may remain stored
          until they are deleted by the workspace owner, removed by an operator, or purged under future retention controls.
          If you need a specific retention or deletion workflow, confirm it with the operator of the Scanlee deployment you use.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Your responsibilities</h2>
        <p>
          Do not upload documents unless you have the right to process them and disclose their contents to the configured AI and
          infrastructure providers involved in your deployment. You are responsible for reviewing exported records before using them
          in accounting, compliance, or operational workflows.
        </p>
      </section>
    </ContentPageShell>
  );
}