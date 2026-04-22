import { describe, expect, it } from "vitest";

import {
  classifyMissingSupabaseBehavior,
  classifyRoute,
  shouldRedirectAuthenticatedUser,
} from "./auth-routing";

describe("route auth policy", () => {
  it.each([
    { pathname: "/", expected: "public-page" },
    { pathname: "/about", expected: "public-page" },
    { pathname: "/acceptable-use", expected: "public-page" },
    { pathname: "/auth/callback", expected: "public-page" },
    { pathname: "/contact", expected: "public-page" },
    { pathname: "/cookies", expected: "public-page" },
    { pathname: "/data-processing", expected: "public-page" },
    { pathname: "/login", expected: "public-page" },
    { pathname: "/privacy", expected: "public-page" },
    { pathname: "/register", expected: "public-page" },
    { pathname: "/terms", expected: "public-page" },
    { pathname: "/dashboard", expected: "private-page" },
    { pathname: "/batches", expected: "private-page" },
    { pathname: "/documents", expected: "private-page" },
    { pathname: "/future-feature", expected: "private-page" },
    { pathname: "/api/health/ai", expected: "public-api" },
    { pathname: "/api", expected: "private-api" },
    { pathname: "/api/document-types", expected: "private-api" },
    { pathname: "/api/documents", expected: "private-api" },
    { pathname: "/api/exports/csv", expected: "private-api" },
    { pathname: "/api/image-batches", expected: "private-api" },
    { pathname: "/api/future-route", expected: "private-api" },
  ])("classifies $pathname as $expected", ({ pathname, expected }) => {
    expect(classifyRoute(pathname)).toBe(expected);
  });

  it.each([
    { pathname: "/login", expected: true },
    { pathname: "/register", expected: true },
    { pathname: "/", expected: false },
    { pathname: "/dashboard", expected: false },
  ])("redirects authenticated users from $pathname when expected", ({ pathname, expected }) => {
    expect(shouldRedirectAuthenticatedUser(pathname)).toBe(expected);
  });

  it.each([
    { pathname: "/dashboard", nodeEnv: "development", expected: "allow" },
    { pathname: "/api/documents", nodeEnv: "development", expected: "allow" },
    { pathname: "/dashboard", nodeEnv: "test", expected: "allow" },
    { pathname: "/dashboard", nodeEnv: "production", expected: "redirect-login" },
    { pathname: "/api/documents", nodeEnv: "production", expected: "deny-api" },
    { pathname: "/", nodeEnv: "production", expected: "allow" },
    { pathname: "/api/health/ai", nodeEnv: "production", expected: "allow" },
  ] as const)(
    "handles missing Supabase config for $pathname in $nodeEnv as $expected",
    ({ pathname, nodeEnv, expected }) => {
      expect(classifyMissingSupabaseBehavior(pathname, nodeEnv)).toBe(expected);
    },
  );
});