"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface Props {
  validUntil: string; // ISO 8601
}

function fmt(ms: number): string {
  if (ms <= 0) return "expired";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days >= 1) {
    return `${days} day${days === 1 ? "" : "s"}, ${hours}h left`;
  }
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / 60_000);
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function QuoteCountdown({ validUntil }: Props) {
  const target = new Date(validUntil).getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const remaining = target - now;
  const expired = remaining <= 0;

  return (
    <div
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium " +
        (expired
          ? "bg-red-50 text-red-700"
          : "bg-accent/10 text-accent-600")
      }
    >
      <Clock size={12} />
      <span>Price valid · {fmt(remaining)}</span>
    </div>
  );
}
