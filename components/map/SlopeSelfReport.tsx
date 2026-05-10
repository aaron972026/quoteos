import { cn } from "@/lib/utils";

interface Props {
  value: 0 | 2; // 0 = flat, 2 = hilly (we use moderate as the default non-flat)
  onChange: (v: 0 | 2) => void;
}

export function SlopeSelfReport({ value, onChange }: Props) {
  const opts: Array<{ v: 0 | 2; label: string; desc: string }> = [
    { v: 0, label: "Mostly flat", desc: "<10% grade" },
    { v: 2, label: "It's hilly", desc: "Steep yard" },
  ];
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-navy">Yard slope</div>
      <div role="radiogroup" className="flex gap-2">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
              value === o.v
                ? "border-accent bg-accent/10 text-navy"
                : "border-navy/15 bg-white text-navy/70 hover:border-navy/30"
            )}
          >
            <div className="text-sm font-semibold">{o.label}</div>
            <div className="text-xs text-navy/50">{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
