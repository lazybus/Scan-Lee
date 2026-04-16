"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { trackPageView } from "@/lib/analytics";

type GoogleAnalyticsProps = {
  measurementId: string;
};

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const hasTrackedInitialPageRef = useRef(false);

  useEffect(() => {
    if (!hasTrackedInitialPageRef.current) {
      hasTrackedInitialPageRef.current = true;
      return;
    }

    const search = window.location.search;
    const path = search ? `${pathname}?${search}` : pathname;
    trackPageView({ measurementId, path });
  }, [measurementId, pathname]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          window.gtag('js', new Date());
          window.gtag('config', ${JSON.stringify(measurementId)});
        `}
      </Script>
    </>
  );
}