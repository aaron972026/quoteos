import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Tight variant shrinks the long dashes — used in cramped headers. */
  tight?: boolean;
  className?: string;
}

/**
 * Section-label eyebrow — small caps in brass, flanked by short/long
 * dashes. Per brand spec: `[short dash][long dash] TEXT [long dash][short dash]`.
 * Pulls styling from `.dashes` utility in `globals.css`.
 */
export function Eyebrow({ children, tight, className }: Props) {
  return (
    <span className={cn("dashes", tight && "tight", className)}>
      <span className="d short" />
      <span className="d long" />
      {children}
      <span className="d long" />
      <span className="d short" />
    </span>
  );
}
