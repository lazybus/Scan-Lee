export type RouteVisibility = "public-api" | "private-api" | "public-page" | "private-page";
export type MissingSupabaseBehavior = "allow" | "deny-api" | "redirect-login";

const publicPaths = new Set([
  "/",
  "/about",
  "/acceptable-use",
  "/auth/callback",
  "/contact",
  "/cookies",
  "/data-processing",
  "/login",
  "/privacy",
  "/register",
  "/terms",
]);

const publicApiPaths = new Set(["/api/health/ai"]);

export const authRoutes = new Set(["/login", "/register"]);

export function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function isPublicPath(pathname: string) {
  return publicPaths.has(pathname);
}

export function isPublicApiPath(pathname: string) {
  return publicApiPaths.has(pathname);
}

export function classifyRoute(pathname: string): RouteVisibility {
  if (isApiPath(pathname)) {
    return isPublicApiPath(pathname) ? "public-api" : "private-api";
  }

  return isPublicPath(pathname) ? "public-page" : "private-page";
}

export function classifyMissingSupabaseBehavior(
  pathname: string,
  nodeEnv = process.env.NODE_ENV,
): MissingSupabaseBehavior {
  if (nodeEnv !== "production") {
    return "allow";
  }

  const routeVisibility = classifyRoute(pathname);

  if (routeVisibility === "private-api") {
    return "deny-api";
  }

  if (routeVisibility === "private-page") {
    return "redirect-login";
  }

  return "allow";
}

export function shouldRedirectAuthenticatedUser(pathname: string) {
  return authRoutes.has(pathname);
}