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
 */
export function LocaleToggle({ className }: { className?: string }) {
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

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-navy/15 bg-white p-0.5 text-[11px] font-semibold",
        className
      )}
      role="group"
      aria-label="Language"
    >
      {OPTIONS.map((o) => {
        const isActive = o.code === current;
        const isLoading = pending === o.code;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => pick(o.code)}
            aria-pressed={isActive}
            disabled={pending !== null && !isLoading}
            className={cn(
              "flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 transition-colors",
              isActive
                ? "bg-navy text-white"
                : "text-navy/60 hover:text-navy"
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
