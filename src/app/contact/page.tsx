import type { Metadata } from "next";

import { ContentPageShell } from "@/components/content-page-shell";

export const metadata: Metadata = {
  title: "Contact | Scanlee",
  description: "How to route legal, privacy, support, or operational questions for a Scanlee deployment.",
};

export default function ContactPage() {
  return (
    <ContentPageShell
      eyebrow="Contact"
      title="Contact and requests"
      lead="Scanlee can be self-hosted or operated by a team for internal use, so the right contact path depends on who runs your deployment."
    >
      <section className="content-page-section paper-panel">
        <h2>Operational questions</h2>
        <p>
          For login issues, workspace access, missing documents, model configuration, or export problems, contact the administrator,
          team, or organization that provided your access to the Scanlee instance you are using.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Privacy and legal requests</h2>
        <p>
          Privacy, retention, deletion, and legal requests should be directed to the operator of the specific Scanlee deployment where
          your data is stored. That operator controls the storage environment, configured processors, and account lifecycle for that
          instance.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Implementation note</h2>
        <p>
          This page is intentionally deployment-neutral because the repository does not currently publish a universal support mailbox
          or legal contact. If you want a single branded contact path, the next step is to replace this draft with your real support
          and privacy channels.
        </p>
      </section>
    </ContentPageShell>
  );
}