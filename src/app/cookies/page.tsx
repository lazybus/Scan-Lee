import type { Metadata } from "next";

import { ContentPageShell } from "@/components/content-page-shell";

export const metadata: Metadata = {
  title: "Cookie Policy | Scanlee",
  description: "First-draft cookie and browser storage policy for Scanlee.",
};

export default function CookiesPage() {
  return (
    <ContentPageShell
      eyebrow="Legal"
      title="Cookie Policy"
      lead="This first draft describes how Scanlee may use browser storage and similar technologies to support authentication, preferences, and basic app behavior."
    >
      <section className="content-page-section paper-panel">
        <h2>Why browser storage is used</h2>
        <p>
          Scanlee relies on browser-side storage primarily to maintain authentication sessions, preserve security state, and support
          expected application behavior while you move between pages in the app.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>What may be stored</h2>
        <ul>
          <li>Session tokens or identifiers required for Supabase authentication flows.</li>
          <li>Theme or display preferences needed to keep the interface consistent between visits.</li>
          <li>Short-lived state used to complete sign-in, navigation, or protected route checks.</li>
          <li>Cookie preference choices that remember whether analytics is allowed or declined.</li>
        </ul>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Analytics and advertising</h2>
        <p>
          Scanlee separates cookie use into categories. Required cookies stay enabled because they are needed for authentication,
          security, and core app behavior. Analytics cookies are optional and only load Google Analytics after you explicitly allow
          them in the cookie preferences panel. If you decline analytics, the analytics scripts are not loaded. Scanlee does not use
          advertising cookies or marketing trackers in the current product setup.
        </p>
      </section>

      <section className="content-page-section paper-panel">
        <h2>Your choices</h2>
        <p>
          Most browsers let you block or clear cookies and local storage. Doing so may sign you out, interrupt protected routes,
          or prevent parts of Scanlee from working correctly. If you clear your cookies, Scanlee may ask again whether you want to
          allow analytics cookies. You can also reopen cookie preferences any time through the Manage cookies control in the footer.
        </p>
      </section>
    </ContentPageShell>
  );
}