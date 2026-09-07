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
  const [diag, setDiag] = useState<string[]>([]);

  // Poll the diag ring buffer so the overlay shows the live gate-tap trace on a
  // phone (same lines the headless e2e reads from the console).
  useEffect(() => {
    if (!debug) return;
    const tick = () => {
      try {
        const w = window as unknown as { __qosDiag?: string[] };
        setDiag(w.__qosDiag ? [...w.__qosDiag] : []);
      } catch {
        /* ignore */
      }
    };
    tick();
    const iv = setInterval(tick, 400);
    return () => clearInterval(iv);
  }, [debug]);

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
        right: 8,
        zIndex: 9999,
        pointerEvents: "none",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
        lineHeight: 1.35,
        padding: "6px 8px",
        borderRadius: 6,
        background: "rgba(22,18,13,0.9)",
        color: "#FCF9F1",
        letterSpacing: "0.02em",
        maxHeight: "40vh",
        overflowY: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: diag.length ? 4 : 0 }}>
        build {sha}
      </div>
      {diag.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}
