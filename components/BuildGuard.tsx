"use client";

import { useEffect, useState } from "react";

/**
 * Two jobs, both about "which build is this device actually running":
 *
 * 1. STALE-BUILD INSURANCE. This app ships no service worker. But a SW
 *    registered by an earlier (pre-PWA-kill) build can pin a phone to a cached
 *    bundle indefinitely — the most likely reason a device tests an old build
 *    after a deploy. On load we unregister any surviving SW and drop its caches,
 *    once. Harmless when there is none.
 *
 * 2. BUILD BADGE. With ?debug=1 in the URL, a tiny fixed chip shows the deployed
 *    commit sha (NEXT_PUBLIC_BUILD_SHA) so a device pass never has to guess
 *    whether a fix is live.
 */
export function BuildGuard() {
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    // Kill any legacy service worker + its caches (one-time, best-effort).
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations?.().then((regs) => {
          for (const reg of regs) reg.unregister();
        });
      }
      if (typeof caches !== "undefined" && caches.keys) {
        caches.keys().then((keys) => {
          for (const k of keys) caches.delete(k);
        });
      }
    } catch {
      // Private mode / unsupported — nothing to clean.
    }

    try {
      setDebug(new URLSearchParams(window.location.search).get("debug") === "1");
    } catch {
      /* no window search — leave hidden */
    }
  }, []);

  if (!debug) return null;

  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom) + 8px)",
        left: 8,
        zIndex: 9999,
        pointerEvents: "none",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 11,
        lineHeight: 1,
        padding: "5px 8px",
        borderRadius: 6,
        background: "rgba(22,18,13,0.9)",
        color: "#FCF9F1",
        letterSpacing: "0.04em",
      }}
    >
      build {sha}
    </div>
  );
}
