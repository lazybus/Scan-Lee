"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GoogleAnalytics } from "@/components/google-analytics";
import {
  cookiePreferencesDialogEventName,
  type CookieConsentPreferences,
  writeCookieConsent,
} from "@/lib/cookie-consent";

export function AnalyticsConsentGate({
  initialPreferences,
  measurementId,
}: {
  initialPreferences: CookieConsentPreferences;
  measurementId: string;
}) {
  const [preferences, setPreferences] = useState<CookieConsentPreferences>(initialPreferences);
  const [draftAnalyticsConsent, setDraftAnalyticsConsent] = useState(
    initialPreferences.analytics === "accepted",
  );
  const [isOpen, setIsOpen] = useState(initialPreferences.analytics === "unknown");

  useEffect(() => {
    function openPreferences() {
      setDraftAnalyticsConsent((current) =>
        isOpen ? current : preferences.analytics === "accepted",
      );
      setIsOpen(true);
    }

    window.addEventListener(cookiePreferencesDialogEventName, openPreferences);

    return () => {
      window.removeEventListener(cookiePreferencesDialogEventName, openPreferences);
    };
  }, [isOpen, preferences.analytics]);

  function applyPreferences(nextAnalyticsConsent: CookieConsentPreferences["analytics"]) {
    const nextPreferences = {
      analytics: nextAnalyticsConsent,
      required: "always",
    } satisfies CookieConsentPreferences;

    writeCookieConsent(nextPreferences);
    setPreferences(nextPreferences);
    setDraftAnalyticsConsent(nextAnalyticsConsent === "accepted");
    setIsOpen(false);
  }

  function closePreferences() {
    if (preferences.analytics === "unknown") {
      return;
    }

    setDraftAnalyticsConsent(preferences.analytics === "accepted");
    setIsOpen(false);
  }

  return (
    <>
      {preferences.analytics === "accepted" ? <GoogleAnalytics measurementId={measurementId} /> : null}
      {isOpen ? (
        <div aria-label="Cookie preferences" aria-live="polite" className="cookie-consent-shell" role="dialog">
          <div className="cookie-consent-banner paper-panel p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="data-label">Cookie Preferences</p>
                <h2 className="mt-3 text-xl font-semibold text-[var(--ink)]">Manage cookie categories</h2>
              </div>
              {preferences.analytics !== "unknown" ? (
                <button className="secondary-button" onClick={closePreferences} type="button">
                  Close
                </button>
              ) : null}
            </div>
            <p className="cookie-consent-copy">
              Required cookies stay enabled so authentication, security, and core application behavior keep working. Analytics
              cookies are optional and only load if you allow them. Read the <Link href="/cookies">Cookie Policy</Link> for
              details.
            </p>
            <div className="cookie-consent-categories mt-5">
              <section className="cookie-consent-category border border-[var(--line-strong)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--ink)]">Required cookies</h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Needed for sign-in state, security checks, and core app behavior.
                    </p>
                  </div>
                  <span className="status-pill" data-state="completed">
                    Always On
                  </span>
                </div>
              </section>
              <section className="cookie-consent-category border border-[var(--line-strong)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--ink)]">Analytics cookies</h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Measures page views, uploads, extraction runs, and exports with Google Analytics.
                    </p>
                  </div>
                  <label className="cookie-toggle">
                    <input
                      checked={draftAnalyticsConsent}
                      onChange={(event) => setDraftAnalyticsConsent(event.target.checked)}
                      type="checkbox"
                    />
                    <span>{draftAnalyticsConsent ? "Allowed" : "Off"}</span>
                  </label>
                </div>
              </section>
            </div>
            <div className="cookie-consent-actions">
              <button className="action-button" onClick={() => applyPreferences("accepted")} type="button">
                Accept All
              </button>
              <button
                className="secondary-button"
                onClick={() => applyPreferences(draftAnalyticsConsent ? "accepted" : "declined")}
                type="button"
              >
                Save Preferences
              </button>
              <button className="secondary-button" onClick={() => applyPreferences("declined")} type="button">
                Decline Analytics
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}