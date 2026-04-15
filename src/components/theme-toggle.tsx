"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLightbulb } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const storageKey = "scanlee-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(storageKey, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    try {
      return window.localStorage.getItem(storageKey) === "light" ? "light" : "dark";
    } catch {
      return document.documentElement.dataset.theme === "light" ? "light" : "dark";
    }
  });

  useEffect(() => {
    try {
      applyTheme(theme);
    } catch {
      applyTheme("dark");
    }
  }, [theme]);

  function handleToggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      aria-pressed={theme === "light"}
      className="theme-icon-button"
      onClick={handleToggle}
      suppressHydrationWarning
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      type="button"
    >
      <FontAwesomeIcon icon={faLightbulb} aria-hidden="true" />
      <span className="sr-only">
        {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      </span>
    </button>
  );
}