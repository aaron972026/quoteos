"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BUSINESS } from "@/lib/business";

interface Props {
  /** Render height in pixels. Width scales by intrinsic aspect ratio. */
  height?: number;
  /** "full" = logo + wordmark; "icon" = just the mark (smaller spots). */
  variant?: "full" | "icon";
  className?: string;
}

/**
 * Brand logo wrapper. Points at /public/logo.svg by default. If the asset
 * file is missing or fails to load, falls back to a styled text wordmark
 * ("FENCEPROS · TULSA") so the layout never shows a broken-image icon.
 *
 * Client component because the fallback needs to react to the <img> onError
 * event — server components can't track that.
 */
export function BrandMark({
  height = 32,
  variant = "full",
  className,
}: Props) {
  const [errored, setErrored] = useState(false);
  const src = variant === "icon" ? "/logo-icon.svg" : "/logo.svg";

  if (errored) {
    return (
      <span
        className={cn("inline-flex items-center gap-2", className)}
        aria-label={BUSINESS.name}
      >
        <span
          className="rounded-md bg-navy px-2 py-1 font-bold tracking-wider text-accent"
          style={{ fontSize: `${Math.round(height * 0.38)}px` }}
        >
          FENCEPROS
        </span>
        <span
          className="font-medium text-navy/60"
          style={{ fontSize: `${Math.round(height * 0.38)}px` }}
        >
          TULSA
        </span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={BUSINESS.name}
      onError={() => setErrored(true)}
      style={{ height: `${height}px`, width: "auto" }}
      className={cn("block select-none", className)}
    />
  );
}
