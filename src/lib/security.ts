const defaultNextPath = "/dashboard";
const disallowedNextPathnames = new Set(["/login", "/register"]);

export function normalizeSafeNextPath(value: FormDataEntryValue | string | null | undefined) {
  const candidate = String(value ?? "").trim();

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return defaultNextPath;
  }

  try {
    const url = new URL(candidate, "http://localhost");
    const { pathname } = url;

    if (
      pathname === "/api" ||
      pathname.startsWith("/api/") ||
      pathname === "/auth" ||
      pathname.startsWith("/auth/") ||
      disallowedNextPathnames.has(pathname)
    ) {
      return defaultNextPath;
    }

    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return defaultNextPath;
  }
}