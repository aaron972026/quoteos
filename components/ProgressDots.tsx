import { cn } from "@/lib/utils";

const STEPS = [
  { key: "address", label: "Address" },
  { key: "confirm", label: "Confirm" },
  { key: "draw", label: "Draw" },
  { key: "configure", label: "Style" },
  { key: "quote", label: "Quote" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function ProgressDots({ current }: { current: StepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <nav
      aria-label="Quote progress"
      className="flex items-center justify-center gap-2 py-3"
    >
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${step.label}`}
              className={cn(
                "h-3 w-3 rounded-full transition-colors",
                done && "bg-accent",
                active && "bg-accent ring-2 ring-accent/40 ring-offset-2",
                !done && !active && "bg-navy/15"
              )}
            />
            {i < STEPS.length - 1 && (
              <span className={cn("h-px w-4", done ? "bg-accent" : "bg-navy/15")} />
            )}
          </div>
        );
      })}
      <span className="ml-3 text-sm text-navy/60">
        Step {currentIndex + 1} of {STEPS.length}
      </span>
    </nav>
  );
}
