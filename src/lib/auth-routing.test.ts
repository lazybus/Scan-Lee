import { describe, expect, it } from "vitest";

import { classifyRoute, shouldRedirectAuthenticatedUser } from "./auth-routing";

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
});