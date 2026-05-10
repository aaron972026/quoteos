import { Star, Shield, Hammer, Banknote } from "lucide-react";

export function TrustStrip({ compact = false }: { compact?: boolean }) {
  const items = [
    { icon: Star, label: "4.9★ Google", className: "text-accent fill-accent" },
    { icon: Hammer, label: "200+ Tulsa fences" },
    { icon: Shield, label: "Licensed & insured" },
    { icon: Banknote, label: "Wisetack financing" },
  ];

  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-navy/60"
          : "flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-navy/70"
      }
    >
      {items.map(({ icon: Icon, label, className }) => (
        <span key={label} className="flex items-center gap-1.5">
          <Icon className={className ?? "text-navy/50"} size={compact ? 14 : 16} />
          {label}
        </span>
      ))}
    </div>
  );
}
