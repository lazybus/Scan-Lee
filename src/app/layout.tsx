import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { signOutAction } from "@/app/auth/actions";
import { AppFooter } from "@/components/app-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import "./globals.css";

const displaySans = Space_Grotesk({
  variable: "--font-display-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Scanlee",
  description: "Secure document extraction with Supabase, personal workspaces, and Ollama.",
};

const themeInitializationScript = `(() => {
  try {
    const storageKey = "scanlee-theme";
    const storedTheme = window.localStorage.getItem(storageKey);
    document.documentElement.dataset.theme = storedTheme === "light" ? "light" : "dark";
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = hasSupabaseEnv() ? await getCurrentUser().catch(() => null) : null;

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${displaySans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="min-h-full bg-[var(--canvas)] text-[var(--ink)]">
        <div className="relative min-h-screen overflow-x-hidden">
          <div className="app-backdrop pointer-events-none absolute inset-0" />
          <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-10">
            <header className="relative border-[3px] border-[var(--ink)] bg-[var(--header-surface)] shadow-[8px_8px_0_var(--accent-strong)] backdrop-blur">
              <div className="flex flex-col gap-4 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-3 text-lg font-semibold uppercase tracking-[0.28em]"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center border-2 border-[var(--ink)] bg-[var(--accent)] text-sm font-bold">
                      SL
                    </span>
                    Scanlee
                  </Link>
                  <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
                    <nav className="flex flex-wrap gap-3 text-sm font-medium uppercase tracking-[0.16em] xl:justify-end">
                      <Link className="nav-chip" href="/">
                        Home
                      </Link>
                      {user ? (
                        <>
                          <Link className="nav-chip" href="/dashboard">
                            Dashboard
                          </Link>
                          <Link className="nav-chip" href="/document-types">
                            Document Types
                          </Link>
                          <Link className="nav-chip" href="/documents">
                            Capture + Review
                          </Link>
                        </>
                      ) : (
                        <>
                          <Link className="nav-chip" href="/login">
                            Log In
                          </Link>
                          <Link className="nav-chip" href="/register">
                            Register
                          </Link>
                        </>
                      )}
                    </nav>
                    <div className="flex items-center gap-3 xl:flex-shrink-0">
                      {user ? (
                        <div className="hidden text-right xl:block">
                          <p className="data-label">Signed In</p>
                          <p className="max-w-56 truncate text-sm text-[var(--muted)]">
                            {user.email}
                          </p>
                        </div>
                      ) : null}
                      <ThemeToggle />
                      {user ? (
                        <form action={signOutAction}>
                          <button className="secondary-button" type="submit">
                            Sign Out
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="max-w-xl font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                    Capture documents, validate structured records, and keep workspace access scoped to each authenticated user.
                  </p>
                </div>
              </div>
            </header>
            <main className="flex-1 py-8">{children}</main>
            <AppFooter />
          </div>
        </div>
      </body>
    </html>
  );
}
