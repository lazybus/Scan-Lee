"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cookiePreferencesDialogEventName } from "@/lib/cookie-consent";

type AiHealth = {
  connected: boolean;
  modelName: string;
  available?: boolean;
  reason?: string;
};

const footerGroups = [
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/cookies", label: "Cookie Policy" },
      { href: "/acceptable-use", label: "Acceptable Use" },
      { href: "/data-processing", label: "Data Processing / AI Use" },
    ],
  },
  {
    heading: "Scanlee",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function AppFooter() {
  const [health, setHealth] = useState<AiHealth | null>(null);
  const currentYear = new Date().getFullYear();

  function openCookiePreferences() {
    window.dispatchEvent(new Event(cookiePreferencesDialogEventName));
  }

  useEffect(() => {
    let active = true;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health/ai", { cache: "no-store" });
        const data = (await response.json()) as AiHealth;

        if (active) {
          setHealth(data);
        }
      } catch {
        if (active) {
          setHealth({
            connected: false,
            modelName: "unknown",
            reason: "Could not reach the AI health route.",
          });
        }
      }
    }

    loadHealth();

    return () => {
      active = false;
    };
  }, []);

  const healthState =
    health?.connected && health.available !== false
      ? "extracted"
      : health?.connected
        ? "processing"
        : "failed";

  const healthTooltip =
    health?.connected && health.available !== false
      ? `Connected to model: ${health.modelName}`
      : health?.connected
        ? health.reason ?? `Configured model unavailable: ${health?.modelName ?? "unknown"}`
        : health?.reason ?? "AI health check unavailable.";

  const healthLabel =
    health?.connected && health.available !== false
      ? "Connected"
      : health?.connected
        ? "Model Missing"
        : "Offline";

  return (
    <footer className="app-footer paper-panel mt-6 px-5 py-5 sm:px-6">
      <div className="footer-grid gap-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="data-label">Scanlee</p>
            <p className="footer-brand-copy max-w-xl text-sm text-[var(--muted)] sm:text-base">
              Structured document extraction for private workspaces, human review, and export-ready records.
            </p>
          </div>

          <div className="space-y-2">
            <p className="data-label">Status</p>
            <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base">
              <span
                aria-label={healthTooltip}
                className="status-pill"
                data-state={healthState}
                title={healthTooltip}
              >
                {healthLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="footer-links-grid gap-8">
          {footerGroups.map((group) => (
            <nav key={group.heading} aria-label={`${group.heading} footer links`} className="footer-nav-group">
              <p className="data-label">{group.heading}</p>
              <div className="mt-3 grid gap-2">
                {group.links.map((link) => (
                  <Link key={link.href} className="footer-link" href={link.href}>
                    {link.label}
                  </Link>
                ))}
                {group.heading === "Legal" ? (
                  <button className="footer-link footer-link-button" onClick={openCookiePreferences} type="button">
                    Manage cookies
                  </button>
                ) : null}
              </div>
            </nav>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>© {currentYear} Scanlee</p>
        <p>
          Project By:{" "}
          <Link
            className="footer-link inline"
            href="https://tobstudios.com"
            rel="noreferrer"
            target="_blank"
          >
            Tob Studios
          </Link>
        </p>
      </div>
    </footer>
  );
}