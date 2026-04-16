type AnalyticsValue = boolean | number | string | null | undefined;

type AnalyticsParams = Record<string, AnalyticsValue>;

type TrackEventOptions = {
  eventCallback?: () => void;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function getGtag() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return null;
  }

  return window.gtag;
}

function sanitizeParams(params: AnalyticsParams): Record<string, boolean | number | string | null> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as Record<string, boolean | number | string | null>;
}

export function trackPageView(input: { measurementId: string; path: string }) {
  const gtag = getGtag();

  if (!gtag) {
    return;
  }

  gtag("config", input.measurementId, {
    page_path: input.path,
    page_title: document.title,
  });
}

export function trackEvent(
  eventName: string,
  params: AnalyticsParams = {},
  options: TrackEventOptions = {},
) {
  const gtag = getGtag();

  if (!gtag) {
    options.eventCallback?.();
    return;
  }

  const payload: Record<string, unknown> = {
    ...sanitizeParams(params),
  };

  if (options.eventCallback) {
    let handled = false;

    const complete = () => {
      if (handled) {
        return;
      }

      handled = true;
      options.eventCallback?.();
    };

    payload.event_callback = complete;
    payload.transport_type = "beacon";
    window.setTimeout(complete, 300);
  }

  gtag("event", eventName, payload);
}