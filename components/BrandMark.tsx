import { cn } from "@/lib/utils";
import { BUSINESS } from "@/lib/business";

interface Props {
  /** Render height in pixels — everything scales from this. */
  height?: number;
  /** "full" = "Ivory." + FENCE CO. lockup; "icon" = compact "I." mark. */
  variant?: "full" | "icon";
  /** Dark surface (noir header/hero) — cream ink instead of near-black. */
  dark?: boolean;
  className?: string;
}

/**
 * Typographic wordmark for Ivory Fence Co., set in the brand fonts that are
 * already loaded app-wide (Fraunces display + Inter). The gold dot is the
 * one gold accent, matching the supplied logo.
 *
 * Why typographic rather than an <img>: the corner appears on BOTH dark and
 * light headers, so a single cream-on-noir raster would vanish on the light
 * screens. This adapts via the `dark` prop. When final vector artwork exists
 * for both backgrounds, swap this body for an <img src> pair keyed on `dark`.
 *
 * No "use client" needed — this is now pure presentational markup.
 */
export function BrandMark({
  height = 32,
  variant = "full",
  dark = false,
  className,
}: Props) {
  // `navy` is the Noir token post-rebrand; `paper`/`cream` are Ivory.
  const wordColor = dark ? "text-paper" : "text-navy";
  const subColor = dark ? "text-cream/55" : "text-steel";

  if (variant === "icon") {
    return (
      <span
        aria-label={BUSINESS.name}
        className={cn(
          "inline-flex select-none items-baseline font-display font-semibold leading-none",
          wordColor,
          className
        )}
        style={{ fontSize: `${Math.round(height * 0.82)}px` }}
      >
        I<span className="text-brass">.</span>
      </span>
    );
  }

  return (
    <span
      aria-label={BUSINESS.name}
      className={cn("inline-flex select-none flex-col leading-none", className)}
    >
      <span
        className={cn("font-display font-semibold", wordColor)}
        style={{
          fontSize: `${Math.round(height * 0.72)}px`,
          letterSpacing: "-0.01em",
        }}
      >
        Ivory<span className="text-brass">.</span>
      </span>
      <span
        className={cn("font-sans font-semibold uppercase", subColor)}
        style={{
          fontSize: `${Math.max(8, Math.round(height * 0.19))}px`,
          letterSpacing: "0.34em",
          marginTop: `${Math.round(height * 0.08)}px`,
        }}
      >
        Fence&nbsp;Co.
      </span>
    </span>
  );
}
