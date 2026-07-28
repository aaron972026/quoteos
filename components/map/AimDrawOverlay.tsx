"use client";

import { useState } from "react";
import { MapPin, RotateCcw, Undo2, Check, Pencil, DoorOpen } from "lucide-react";
import type { useT } from "@/lib/i18n/use-locale";

/**
 * Mobile "aim & drop" overlay. Presentational only — every mutation is a
 * callback into the page's shared draw reducer (lib/map/draw-state). Rendered
 * as a child of the (relative) map container: reticle at map center, helper
 * chip up top, controls in a bottom sheet. The gold preview/committed segments
 * live on the map layer (FenceMap), not here.
 *
 * Spec colors kept literal where they aren't brand tokens: reticle ivory ring
 * + noir glow + gold dot; Start-over error red #9E3B2E.
 */

export interface AimDrawOverlayProps {
  /** Render nothing unless aim mode is active (pointer:coarse). */
  active: boolean;
  /** "draw" while placing posts; "review" after Finish Drawing. */
  stage: "draw" | "review";
  totalLf: number;
  /** Live "(+XX ft)" for the segment to the reticle; 0 when nothing to add. */
  segmentDeltaLf: number;
  aiming: boolean; // true only before the first post
  canUndo: boolean;
  canFinish: boolean;
  /** Below the accuracy zoom threshold — Drop is disabled, guard chip shows. */
  zoomOk: boolean;
  t: ReturnType<typeof useT>;
  onDrop: () => void;
  onUndo: () => void;
  onFinish: () => void;
  onStartOver: () => void;
  onEdit: () => void;
  /** Optional — gates panel arrives in slice (b); button hidden until wired. */
  onAddGates?: () => void;
}

function ft(n: number): string {
  return Math.round(n).toLocaleString();
}

export function AimDrawOverlay(props: AimDrawOverlayProps) {
  const {
    active,
    stage,
    totalLf,
    segmentDeltaLf,
    aiming,
    canUndo,
    canFinish,
    zoomOk,
    t,
    onDrop,
    onUndo,
    onFinish,
    onStartOver,
    onEdit,
    onAddGates,
  } = props;
  const c = t.draw;
  const [confirmClear, setConfirmClear] = useState(false);

  if (!active) return null;

  return (
    <>
      {/* Fixed center reticle — only while placing posts. */}
      {stage === "draw" && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              border: "1.5px solid #FCF9F1",
              boxShadow: "0 0 0 3px rgba(22,18,13,0.30)",
            }}
          >
            <span
              className="rounded-full"
              style={{ width: 8, height: 8, background: "#C99A3F" }}
            />
          </div>
        </div>
      )}

      {/* Helper chip — aim prompt, or the zoom guard when too far out. */}
      {stage === "draw" && (aiming || !zoomOk) && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2">
          <div className="rounded-pill bg-navy/95 px-4 py-2 text-center font-body text-[13px] leading-[1.3] text-cream shadow-card-lg">
            {!zoomOk ? c.aimZoomGuard : c.aimHelperStart}
          </div>
        </div>
      )}

      {/* Bottom sheet. */}
      <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-[18px] border-t border-cream-deep bg-paper px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 shadow-card-lg">
        {/* Live counter — total LF + segment delta. */}
        {(stage === "review" || !aiming) && (
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-spec text-brick">
              {stage === "review" ? c.aimReviewTitle : c.aimTotalLabel}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-display text-[26px] font-bold tabular-nums leading-none text-navy">
                {ft(totalLf)}
              </span>
              <span className="font-body text-[13px] text-steel">
                {c.aimFtUnit}
              </span>
              {stage === "draw" && segmentDeltaLf > 0 && (
                <span
                  className="font-body text-[13px] tabular-nums"
                  style={{ color: "#8A8172" }}
                >
                  (+{ft(segmentDeltaLf)} {c.aimFtUnit})
                </span>
              )}
            </span>
          </div>
        )}

        {stage === "draw" ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onDrop}
              disabled={!zoomOk}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-sm bg-brick px-6 font-display text-[15px] font-semibold uppercase tracking-eyebrow text-cream transition-colors hover:bg-brick-deep disabled:opacity-45"
              style={{ height: 52 }}
            >
              <MapPin size={17} strokeWidth={2.5} />
              {c.aimDrop}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-sm border border-navy/25 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:bg-navy/5 disabled:opacity-40"
              >
                <Undo2 size={14} strokeWidth={2.5} />
                {c.aimUndo}
              </button>
              <button
                type="button"
                onClick={onFinish}
                disabled={!canFinish}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-sm border border-brick bg-brick/5 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-brick transition-colors hover:bg-brick/10 disabled:opacity-40"
              >
                <Check size={14} strokeWidth={2.5} />
                {c.aimFinish}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="mx-auto block pt-1 font-display text-[12px] font-semibold uppercase tracking-eyebrow"
              style={{ color: "#9E3B2E" }}
            >
              {c.aimStartOver}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-sm border border-navy/25 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:bg-navy/5"
              >
                <Pencil size={14} strokeWidth={2.5} />
                {c.aimEdit}
              </button>
              {onAddGates && (
                <button
                  type="button"
                  onClick={onAddGates}
                  className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-sm border font-display text-[13px] font-semibold uppercase tracking-eyebrow transition-colors"
                  style={{ borderColor: "#8A6722", color: "#8A6722" }}
                >
                  <DoorOpen size={14} strokeWidth={2.5} />
                  {c.aimAddGates}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Start-over confirm sheet. */}
      {confirmClear && (
        <div className="absolute inset-0 z-40 flex items-end bg-navy/40">
          <div className="w-full rounded-t-[18px] border-t border-cream-deep bg-paper px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-5 shadow-card-lg">
            <p className="text-center font-display text-[16px] font-semibold uppercase tracking-eyebrow text-navy">
              {c.aimClearTitle}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="h-12 flex-1 rounded-sm border border-navy/25 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:bg-navy/5"
              >
                {c.aimClearCancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClear(false);
                  onStartOver();
                }}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-sm font-display text-[13px] font-semibold uppercase tracking-eyebrow text-cream"
                style={{ background: "#9E3B2E" }}
              >
                <RotateCcw size={14} strokeWidth={2.5} />
                {c.aimClearConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
