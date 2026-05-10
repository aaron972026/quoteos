"use client";

import { useEffect } from "react";

/**
 * Mounts on every public page; ensures an anonymous session is initialized.
 * Idempotent — server-side reuses an existing JWT cookie if present.
 */
export function SessionInit() {
  useEffect(() => {
    // Capture UTM + referrer from current URL
    const url = new URL(window.location.href);
    const body = {
      utm_source: url.searchParams.get("utm_source") ?? undefined,
      utm_medium: url.searchParams.get("utm_medium") ?? undefined,
      utm_campaign: url.searchParams.get("utm_campaign") ?? undefined,
      referrer: document.referrer || undefined,
    };

    fetch("/api/v1/sessions/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    }).catch(() => {
      // Silent — session can be re-initialized on next interaction
    });
  }, []);

  return null;
}
