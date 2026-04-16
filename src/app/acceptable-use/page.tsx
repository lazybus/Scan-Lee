import type { Metadata } from "next";

import { ContentPageShell } from "@/components/content-page-shell";

export const metadata: Metadata = {
  title: "Acceptable Use | Scanlee",
  description: "First-draft acceptable use policy for Scanlee workspaces, uploads, extraction, and exports.",
};

export default function AcceptableUsePage() {
  return (
    <ContentPageShell
      eyebrow="Legal"
      title="Acceptable Use"
      lead="Scanlee is meant for legitimate document capture and structured extraction workflows. This draft outlines uses that are expected and uses that are out of bounds."
    >
      <section className="content-page-section paper-panel">
        <h2>Permitted use</h2>
        <p>
          You may use Scanlee to organize document types, upload business records, extract structured data, review model output,
          and export verified results for internal operations.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Restricted use</h2>
        <ul>
          <li>Do not upload malware, exploit payloads, or documents intended to disrupt the service.</li>
          <li>Do not probe, scrape, or automate against the service in ways that degrade performance or bypass controls.</li>
          <li>Do not use extracted output to impersonate entities, forge records, or mislead counterparties.</li>
          <li>Do not process documents when you lack authority to access, store, or disclose their contents.</li>
        </ul>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Shared and public templates</h2>
        <p>
          If you publish or duplicate reusable document-type templates, make sure they do not disclose confidential source material,
          secrets, or proprietary instructions you are not allowed to share. Public templates should remain generic and reusable.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Enforcement</h2>
        <p>
          Deployments may suspend access, remove content, or restrict features when use appears unsafe, unlawful, or disruptive.
          Operators may also preserve relevant logs or records needed to investigate abuse or protect the service.
        </p>
      </section>
    </ContentPageShell>
  );
}