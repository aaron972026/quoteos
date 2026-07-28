"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Undo2, Check, Pencil, DoorOpen, MapPin } from "lucide-react";
import type { useT } from "@/lib/i18n/use-locale";

/**
 * Mobile "aim & drop" overlay. Presentational only — every mutation is a
 * callback into the page's shared draw reducer (lib/map/draw-state). Rendered
 * as a child of the (relative) map container.
 *
 * The reticle sits at the centre of the VISIBLE area (above the sheet), and
 * the measured sheet height is reported via onSheetHeight so the page can pad
 * the map camera to match — reticle and drop coord stay aligned. The live LF
 * counter is NOT here; it lives in the page footer (no duplication).
 */

export interface AimDrawOverlayProps {
  active: boolean;
  stage: "draw" | "review";
  aiming: boolean;
  canUndo: boolean;
  canFinish: boolean;
  zoomOk: boolean;
  t: ReturnType<typeof useT>;
  onDrop: () => void;
  onUndo: () => void;
  onFinish: () => void;
  onStartOver: () => void;
  onEdit: () => void;
  onAddGates?: () => void;
  /** Reports the rendered sheet height (px) so the page can pad the camera. */
  onSheetHeight?: (px: number) => void;
}

export function AimDrawOverlay(props: AimDrawOverlayProps) {
  const {
    active,
    stage,
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
    onSheetHeight,
  } = props;
  const c = t.draw;
  const [confirmClear, setConfirmClear] = useState(false);
  const [sheetH, setSheetH] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const onSheetHeightRef = useRef(onSheetHeight);
  onSheetHeightRef.current = onSheetHeight;

  // Measure the sheet so the reticle + camera padding track its real height
  // (safe-area varies by device).
  useEffect(() => {
    if (!active) return;
    const el = sheetRef.current;
    if (!el) return;
    const report = () => {
      const h = el.getBoundingClientRect().height;
      setSheetH(h);
      onSheetHeightRef.current?.(h);
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, stage]);

  if (!active) return null;

  return (
    <>
      {/* Reticle at the centre of the visible area (container centre shifted
          up by half the sheet height). */}
      {stage === "draw" && (
        <div
          className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
          style={{ top: `calc(50% - ${sheetH / 2}px)` }}
        >
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

      {/* Control sheet — one compact row + a small utility row. */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 z-30 rounded-t-[18px] border-t border-cream-deep bg-paper px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-card-lg"
      >
        {stage === "draw" ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={c.aimUndo}
                onClick={onUndo}
                disabled={!canUndo}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-sm border border-navy/25 text-navy transition-colors hover:bg-navy/5 disabled:opacity-40"
              >
                <Undo2 size={18} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={onDrop}
                disabled={!zoomOk}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-sm bg-brick px-4 font-display text-[15px] font-semibold uppercase tracking-eyebrow text-cream transition-colors hover:bg-brick-deep disabled:opacity-45"
              >
                <MapPin size={17} strokeWidth={2.5} />
                {c.aimDrop}
              </button>
              <button
                type="button"
                aria-label={c.aimFinish}
                onClick={onFinish}
                disabled={!canFinish}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-sm border border-brick bg-brick/5 text-brick transition-colors hover:bg-brick/10 disabled:opacity-40"
              >
                <Check size={18} strokeWidth={2.5} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="mx-auto mt-2 block font-display text-[11px] font-semibold uppercase tracking-eyebrow"
              style={{ color: "#9E3B2E" }}
            >
              {c.aimStartOver}
            </button>
          </>
        ) : (
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
