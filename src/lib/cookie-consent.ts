export const cookieConsentCookieName = "scanlee_cookie_preferences";
export const legacyAnalyticsConsentCookieName = "scanlee_analytics_consent";
export const cookiePreferencesDialogEventName = "scanlee:open-cookie-preferences";

const consentLifetimeSeconds = 60 * 60 * 24 * 365;

export type AnalyticsConsentState = "accepted" | "declined" | "unknown";

export type CookieConsentPreferences = {
  analytics: AnalyticsConsentState;
  required: "always";
};

export function parseCookieConsentValue(value: string | null | undefined): CookieConsentPreferences {
  if (!value) {
    return {
      analytics: "unknown",
      required: "always",
    };
  }

  if (value === "accepted" || value === "declined") {
    return {
      analytics: value,
      required: "always",
    };
  }

  const entries = Object.fromEntries(
    value.split("|").map((entry) => {
      const [key, rawValue] = entry.split(":");
      return [key, rawValue];
    }),
  );

  const analytics =
    entries.analytics === "accepted" || entries.analytics === "declined"
      ? entries.analytics
      : "unknown";

  return {
    analytics,
    required: "always",
  };
}

export function serializeCookieConsentValue(preferences: CookieConsentPreferences): string {
  return `required:always|analytics:${preferences.analytics}`;
}

export function writeCookieConsent(preferences: CookieConsentPreferences) {
  document.cookie = [
    `${cookieConsentCookieName}=${serializeCookieConsentValue(preferences)}`,
    "Path=/",
    `Max-Age=${consentLifetimeSeconds}`,
    "SameSite=Lax",
  ].join("; ");

  document.cookie = [
    `${legacyAnalyticsConsentCookieName}=`,
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
  ].join("; ");
}