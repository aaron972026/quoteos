import { cn } from "@/lib/utils";

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
}

export function DemoToggle({ value, onChange }: Props) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-navy">
        Replacing an existing fence?
      </div>
      <div role="radiogroup" className="flex gap-2">
        {[
          { v: false, label: "No, new install" },
          { v: true, label: "Yes, tear-out needed" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
              value === o.v
                ? "border-accent bg-accent/10 text-navy"
                : "border-navy/15 bg-white text-navy/70 hover:border-navy/30"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
