"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  validUntil: string;
  prefix?: string;
  expiredLabel?: string;
  /** Inverted = on cream/paper. Default = on navy. */
  inverted?: boolean;
}

function fmt(ms: number, expiredLabel: string): string {
  if (ms <= 0) return expiredLabel;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days >= 1) {
    return `${days} day${days === 1 ? "" : "s"}, ${hours}h left`;
  }
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / 60_000);
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function QuoteCountdown({
  validUntil,
  prefix = "Price valid",
  expiredLabel = "Expired",
  inverted = false,
}: Props) {
  const target = new Date(validUntil).getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const remaining = target - now;
  const expired = remaining <= 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 font-mono text-[11px] uppercase tracking-spec",
        expired
          ? "bg-brick/10 text-brick"
          : inverted
            ? "bg-brass/20 text-brass"
            : "bg-cream-deep text-brick"
      )}
    >
      <Clock size={11} strokeWidth={2.5} />
      <span>
        {prefix} · {fmt(remaining, expiredLabel)}
      </span>
    </span>
  );
}
