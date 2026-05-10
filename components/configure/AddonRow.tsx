import { cn } from "@/lib/utils";

interface Props {
  label: string;
  description: string;
  priceLabel: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (checked: boolean) => void;
}

export function AddonRow({
  label,
  description,
  priceLabel,
  checked,
  disabled,
  disabledReason,
  onChange,
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        checked && !disabled
          ? "border-accent bg-accent/5"
          : "border-navy/10 bg-white",
        !disabled && "hover:border-navy/30",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <div
        className={cn(
          "flex h-6 w-10 flex-shrink-0 items-center rounded-full transition-colors",
          checked && !disabled ? "bg-accent" : "bg-navy/15"
        )}
      >
        <span
          className={cn(
            "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked && !disabled ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-navy">{label}</div>
        <div className="text-xs text-navy/60">
          {disabled && disabledReason ? disabledReason : description}
        </div>
      </div>
      <div className="flex-shrink-0 text-sm font-semibold text-navy/80">
        {priceLabel}
      </div>
    </button>
  );
}
