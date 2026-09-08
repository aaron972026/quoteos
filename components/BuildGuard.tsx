"use client";

import { useEffect, useState } from "react";

/**
 * Two jobs, both about "which build is this device actually running":
 *
 * 1. STALE-BUILD INSURANCE. This app ships no service worker, but a SW from an
 *    earlier (pre-PWA-kill) build can pin a phone to a cached bundle. We
 *    UNREGISTER any survivor so it stops controlling future loads. We do NOT
 *    delete the Cache Storage out from under the running page — doing that pulls
 *    chunks the current (SW-served, stale) HTML still references and triggers a
 *    ChunkLoadError → "Application error". Instead, if a SW was actually
 *    controlling THIS load, we do a single guarded reload to land on a clean
 *    network build.
 *
 * 2. BUILD BADGE. With ?debug=1, a fixed chip shows NEXT_PUBLIC_BUILD_SHA and the
 *    live [map-diag] trace so a device pass never has to guess the build.
 *
 * A cleanup helper must NEVER crash the app: every path here is wrapped and
 * degrades to a no-op.
 */
export function BuildGuard() {
  const [debug, setDebug] = useState(false);
  const [diag, setDiag] = useState<string[]>([]);

  // Poll the diag ring buffer so the overlay shows the live gate-tap trace on a
  // phone (same lines the headless e2e reads from the console).
  useEffect(() => {
    if (!debug) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    try {
      const tick = () => {
        try {
          const w = window as unknown as { __qosDiag?: string[] };
          setDiag(w.__qosDiag ? [...w.__qosDiag] : []);
        } catch {
          /* ignore */
        }
      };
      tick();
      iv = setInterval(tick, 400);
    } catch {
      /* ignore */
    }
    return () => {
      if (iv) clearInterval(iv);
    };
  }, [debug]);

  useEffect(() => {
    // Everything in here is best-effort. A throw or rejection must not surface.
    try {
      if (
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        navigator.serviceWorker?.getRegistrations
      ) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            if (!regs || regs.length === 0) return;
            const wasControlled = !!navigator.serviceWorker.controller;
            return Promise.all(regs.map((r) => r.unregister().catch(() => false)))
              .then(() => {
                // Only reload if a SW was actually serving this page, and only
                // once per tab, so a stale cached bundle can't strand the user
                // and we can never loop.
                try {
                  if (wasControlled && !sessionStorage.getItem("qos-sw-reset")) {
                    sessionStorage.setItem("qos-sw-reset", "1");
                    window.location.reload();
                  }
                } catch {
                  /* sessionStorage unavailable — skip the reload, no loop */
                }
              })
              .catch(() => {});
          })
          .catch(() => {});
      }
    } catch {
      /* serviceWorker access threw — nothing to clean */
    }

    try {
      setDebug(new URLSearchParams(window.location.search).get("debug") === "1");
    } catch {
      /* no window search — leave hidden */
    }
  }, []);

  if (!debug) return null;

  let sha = "dev";
  try {
    sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
  } catch {
    /* env access — keep default */
  }
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
