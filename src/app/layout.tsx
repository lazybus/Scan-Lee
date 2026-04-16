import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { signOutAction } from "@/app/auth/actions";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
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
      <body className="min-h-full bg-[var(--canvas)] text-[var(--ink)]">
        <div className="relative min-h-screen overflow-x-hidden">
          <div className="app-backdrop pointer-events-none absolute inset-0" />
          <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-10">
            <AppHeader signOutAction={signOutAction} userEmail={user?.email ?? null} />
            <main className="flex-1 py-8">{children}</main>
            <AppFooter />
          </div>
        </div>
      </body>
    </html>
  );
}
