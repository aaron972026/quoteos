"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Shown above the retry button. Defaults to the standard map copy. */
  title?: string;
  description?: string;
}

interface State {
  hasError: boolean;
  message: string | null;
}

/**
 * React error boundary specifically wrapping the FenceMap component. A thrown
 * render-time error inside Mapbox + mapbox-gl-draw can otherwise take down
 * the whole /draw page with a blank screen; this catches it and surfaces a
 * retry UI instead.
 *
 * CRIT-2 mitigation: the user's universal recovery move (refresh) must
 * always lead somewhere. If init throws, we render a friendly card with a
 * "Try again" button rather than a dead white screen.
 */
export class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message ?? "Unknown error" };
  }

  componentDidCatch(err: Error, info: { componentStack?: string }) {
    console.error("[MapErrorBoundary] caught", err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[420px] items-center justify-center bg-paper/95 p-6">
          <div className="max-w-sm text-center">
            <div className="font-display text-[18px] font-bold uppercase tracking-eyebrow text-navy">
              {this.props.title ?? "Map Didn’t Load"}
            </div>
            <p className="mt-2 font-body text-[13px] leading-[1.5] text-char">
              {this.props.description ??
                "Looks like a network hiccup. Tap below to try again — your progress on the rest of the quote is saved."}
            </p>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="mt-5 inline-flex h-12 items-center gap-2 rounded-sm bg-brick px-6 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-cream shadow-cta transition-colors hover:bg-brick-deep"
            >
              Try Again
            </button>
            {this.state.message && (
              <p className="mt-3 font-mono text-[10px] uppercase tracking-spec text-steel">
                {this.state.message}
              </p>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
