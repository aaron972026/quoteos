"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/use-locale";
import { type Locale } from "@/lib/i18n/types";

const OPTIONS: Array<{ code: Locale; label: string }> = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
];

/**
 * Compact EN/ES toggle. Posts to /api/v1/locale to write the cookie, then
 * router.refresh()'s so server-rendered text re-renders with the new dict.
 * `dark` variant inverts the palette so the pill stays legible inside
 * the navy header used on /draw, /configure, /quote.
 */
export function LocaleToggle({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  const router = useRouter();
  const current = useLocale();
  const [pending, setPending] = useState<Locale | null>(null);
  const [, startTransition] = useTransition();

  async function pick(code: Locale) {
    if (code === current || pending) return;
    setPending(code);
    try {
      const r = await fetch("/api/v1/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locale: code }),
      });
      if (!r.ok) return;
      startTransition(() => router.refresh());
    } finally {
      setPending(null);
    }
  }

  const wrapper = dark
    ? "border-cream/30 bg-cream/10"
    : "border-navy/15 bg-white";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border p-0.5 text-[11px] font-semibold",
        wrapper,
        className
      )}
      role="group"
      aria-label="Language"
    >
      {OPTIONS.map((o) => {
        const isActive = o.code === current;
        const isLoading = pending === o.code;
        const activeCls = dark ? "bg-cream text-navy" : "bg-navy text-white";
        const inactiveCls = dark
          ? "text-cream/70 hover:text-cream"
          : "text-navy/60 hover:text-navy";
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => pick(o.code)}
            aria-pressed={isActive}
            disabled={pending !== null && !isLoading}
            // py-1.5 + 0.5 wrapper padding lands the button at ~28px tall;
            // the 68px header above provides the >=44px tap target around it.
            className={cn(
              "flex min-w-[32px] items-center justify-center rounded-full px-2.5 py-1.5 transition-colors",
              isActive ? activeCls : inactiveCls
            )}
          >
            {isLoading ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              o.label
            )}
          </button>
        );
      })}
    </div>
  );
}
