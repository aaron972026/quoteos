import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        // Brand v1.0 primary — brick on cream, Oswald uppercase. Default CTA.
        display:
          "bg-brick text-cream font-display uppercase tracking-eyebrow hover:bg-brick-deep active:translate-y-px focus-visible:ring-brick shadow-cta",
        // Brand v1.0 secondary — navy outline, neutral background.
        outline:
          "border border-navy/30 bg-transparent text-navy hover:border-navy hover:bg-navy/5 focus-visible:ring-navy font-display uppercase tracking-eyebrow",
        // Brand v1.0 secondary on dark surfaces (over navy).
        "outline-dark":
          "border border-cream/40 bg-transparent text-cream hover:border-cream hover:bg-cream/10 focus-visible:ring-cream font-display uppercase tracking-eyebrow",
        // Legacy variants — kept so existing callsites keep compiling
        // until each screen is migrated in Slices C–G.
        primary:
          "bg-accent text-cream hover:bg-brick-deep focus-visible:ring-accent shadow-cta",
        secondary:
          "bg-navy text-cream hover:bg-navy-soft focus-visible:ring-navy",
        ghost: "text-navy hover:bg-navy/5 focus-visible:ring-navy",
        link: "text-navy underline-offset-4 hover:underline",
      },
      size: {
        // Brand sizes per spec
        sm: "h-10 px-5 text-[13px]",
        md: "h-12 px-7 text-[14px]",
        lg: "h-14 px-9 text-[15px]",
        xl: "h-16 px-10 text-[16px]",
        icon: "h-10 w-10",
        // Legacy default — matches old h-12 height
        default: "h-12 px-6 py-3 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
