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
        "group flex w-full items-start gap-4 rounded-sm border p-4 text-left transition-all",
        checked && !disabled
          ? "border-navy bg-cream"
          : "border-navy/15 bg-paper",
        !disabled && "hover:border-navy/40",
        disabled && "cursor-not-allowed opacity-55"
      )}
    >
      {/* Toggle switch — brand-style 36×20 oval */}
      <div
        className={cn(
          "mt-0.5 flex h-5 w-9 flex-shrink-0 items-center rounded-pill border transition-colors",
          checked && !disabled
            ? "border-brick bg-brick"
            : "border-steel-soft bg-steel-soft/30"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-pill bg-paper shadow-sm transition-transform",
            checked && !disabled ? "translate-x-[18px]" : "translate-x-[2px]"
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy">
            {label}
          </span>
          <span
            className={cn(
              "flex-shrink-0 font-mono text-[11px] font-semibold uppercase tracking-spec",
              checked && !disabled ? "text-brick" : "text-steel"
            )}
          >
            {priceLabel}
          </span>
        </div>
        <p className="mt-1 font-body text-[12.5px] leading-[1.45] text-steel">
          {disabled && disabledReason ? disabledReason : description}
        </p>
      </div>
    </button>
  );
}
