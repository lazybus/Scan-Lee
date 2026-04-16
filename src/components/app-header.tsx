"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faRightFromBracket, faXmark } from "@fortawesome/free-solid-svg-icons";

import { ThemeToggle } from "@/components/theme-toggle";

type AppHeaderProps = {
  userEmail: string | null;
  signOutAction: () => Promise<void>;
};

const authenticatedLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/document-types", label: "Document Types" },
  { href: "/batches", label: "Capture + Review" },
];

const guestLinks = [
  { href: "/", label: "Home" },
  { href: "/login", label: "Log In" },
  { href: "/register", label: "Register" },
];

export function AppHeader({ userEmail, signOutAction }: AppHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const links = userEmail ? authenticatedLinks : guestLinks;

  useEffect(() => {
    if (!isMenuOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header className="site-header relative">
      <div className="flex flex-col gap-4 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between xl:items-center">
          <div className="flex items-start justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-3 text-lg font-semibold uppercase tracking-[0.28em]"
            >
              <span className="logo-badge text-sm font-bold">
                SL
              </span>
              Scanlee
            </Link>
            <div className="flex items-center gap-3 md:hidden">
              <button
                aria-controls="mobile-site-menu"
                aria-expanded={isMenuOpen}
                aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                className="mobile-menu-button"
                onClick={() => setIsMenuOpen((open) => !open)}
                type="button"
              >
                <FontAwesomeIcon aria-hidden="true" icon={isMenuOpen ? faXmark : faBars} />
              </button>
            </div>
          </div>

          <div className="hidden md:flex md:flex-1 md:items-center md:justify-end md:gap-3">
            <nav className="flex flex-wrap justify-end gap-3 text-sm font-medium uppercase tracking-[0.16em]">
              {links.map((link) => (
                <Link key={link.href} className="nav-chip" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 md:flex-shrink-0">
              {userEmail ? (
                <p className="hidden max-w-56 truncate text-sm text-[var(--muted)] lg:block">{userEmail}</p>
              ) : null}
              {userEmail ? (
                <form action={signOutAction}>
                  <button
                    aria-label="Sign out"
                    className="header-icon-button"
                    title="Sign out"
                    type="submit"
                  >
                    <FontAwesomeIcon aria-hidden="true" icon={faRightFromBracket} />
                  </button>
                </form>
              ) : null}
              <ThemeToggle />
            </div>
          </div>
        </div>

        <div
          id="mobile-site-menu"
          className={`mobile-menu-panel md:hidden ${isMenuOpen ? "grid" : "hidden"}`}
        >
          <nav className="grid gap-3 text-sm font-medium uppercase tracking-[0.16em]">
            {links.map((link) => (
              <Link
                key={link.href}
                className="nav-chip text-center"
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {userEmail ? (
            <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
              <p className="truncate text-sm text-[var(--muted)]">{userEmail}</p>
              <div className="flex items-center gap-2">
                <form action={signOutAction}>
                  <button
                    aria-label="Sign out"
                    className="header-icon-button"
                    title="Sign out"
                    type="submit"
                  >
                    <FontAwesomeIcon aria-hidden="true" icon={faRightFromBracket} />
                  </button>
                </form>
                <ThemeToggle />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}