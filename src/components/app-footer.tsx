"use client";

import { useEffect, useState } from "react";

type AiHealth = {
  connected: boolean;
  modelName: string;
  available?: boolean;
  reason?: string;
};

export function AppFooter() {
  const [health, setHealth] = useState<AiHealth | null>(null);

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

  const healthLabel =
    health?.connected && health.available !== false
      ? "Connected"
      : health?.connected
        ? "Model Missing"
        : "Offline";

  return (
    <footer className="app-footer paper-panel mt-6 px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="data-label">Status</p>
          <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base">
            <span className="font-semibold text-[var(--ink)]">Google AI Studio</span>
            <span className="status-pill" data-state={healthState}>
              {healthLabel}
            </span>
          </div>
        </div>

        <div className="space-y-1 text-sm text-[var(--muted)] md:text-right">
          <p>Model: {health?.modelName ?? "Checking..."}</p>
          {health?.connected === false && health.reason ? <p>{health.reason}</p> : null}
        </div>
      </div>
    </footer>
  );
}