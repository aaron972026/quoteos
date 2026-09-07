"use client";

import { useEffect, useRef, useState } from "react";
import {
  DoorOpen,
  DoorClosed,
  MoveHorizontal,
  Trash2,
  Check,
  X,
  Info,
} from "lucide-react";
import type { useT } from "@/lib/i18n/use-locale";

/**
 * Gates sub-mode bottom sheet (G2). Presentational only — every mutation is a
 * callback into the page's shared draw reducer. Replaces the draw/adjust sheet
 * while gates mode is active (one sheet at a time is enforced by the page).
 *
 * The "active spec" (type + width) is EITHER the pending gate (nothing
 * selected — the next line-tap places it) or the selected gate being edited.
 * The page decides which, and routes onPickType/onPickWidth to PLACE_GATE's
 * spec or to EDIT_GATE accordingly.
 */

type GateType = "single" | "double" | "sliding";

export interface AimGatesOverlayProps {
  active: boolean;
  t: ReturnType<typeof useT>;
  count: number;
  /** Active spec type (pending, or the selected gate's). */
  type: GateType;
  /** Active spec width in feet. */
  width: number;
  /** Custom width chip is selected (width came from the number input). */
  isCustom: boolean;
  /** Current value of the custom number input. */
  customWidth: number;
  onPickType: (type: GateType) => void;
  onPickWidth: (w: number) => void;
  onPickCustom: () => void;
  onCustomWidthChange: (n: number) => void;
  onApplyCustom: () => void;
  /** True when a placed gate is selected (edit mode: shows Remove + a title). */
  editing: boolean;
  onRemove: () => void;
  onDeselect: () => void;
  /** Active spec is priced-at-visit (sliding, or custom width > 6). */
  deferred: boolean;
  /** The last place/edit was rejected for being wider than the section. */
  tooWide: boolean;
  onDone: () => void;
  onSheetHeight?: (px: number) => void;
}

const TYPES: Array<{ value: GateType; icon: typeof DoorOpen }> = [
  { value: "single", icon: DoorOpen },
  { value: "double", icon: DoorClosed },
  { value: "sliding", icon: MoveHorizontal },
];
const WIDTHS = [4, 5, 6];

export function AimGatesOverlay(props: AimGatesOverlayProps) {
  const {
    active,
    t,
    count,
    type,
    width,
    isCustom,
    customWidth,
    onPickType,
    onPickWidth,
    onPickCustom,
    onCustomWidthChange,
    onApplyCustom,
    editing,
    onRemove,
    onDeselect,
    deferred,
    tooWide,
    onDone,
    onSheetHeight,
  } = props;
  const c = t.draw;
  const [sheetH, setSheetH] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const onSheetHeightRef = useRef(onSheetHeight);
  onSheetHeightRef.current = onSheetHeight;

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
  }, [active, editing, isCustom, deferred]);

  if (!active) return null;

  const typeLabel = (v: GateType) =>
    v === "single" ? c.aimGateSingle : v === "double" ? c.aimGateDouble : c.aimGateSliding;

  return (
    <>
      {/* Too-wide feedback chip — floats above the sheet for ~3s. */}
      {tooWide && (
        <div
          className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2"
          style={{ bottom: sheetH + 12 }}
        >
          <div
            className="max-w-[88vw] rounded-pill px-4 py-2 text-center font-body text-[13px] leading-[1.3] text-cream shadow-card-lg"
            style={{ background: "#9E3B2E" }}
          >
            {c.aimGatesTooWide}
          </div>
        </div>
      )}

      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 z-30 max-h-[80%] overflow-y-auto rounded-t-[18px] border-t border-cream-deep bg-paper px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-card-lg"
        role="dialog"
        aria-label={editing ? c.aimGatesEditTitle : c.aimGatesTitle}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-navy/15" />

        <div className="flex items-center justify-between">
          <div className="font-display text-[15px] font-semibold uppercase tracking-eyebrow text-navy">
            {editing ? c.aimGatesEditTitle : c.aimGatesTitle}
          </div>
          {editing && (
            <button
              type="button"
              aria-label={c.aimJunctionCancel}
              onClick={onDeselect}
              className="flex h-8 w-8 items-center justify-center rounded-full text-navy transition-colors hover:bg-navy/5"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
        {!editing && (
          <p className="mt-0.5 font-body text-[12px] leading-[1.35] text-steel">
            {c.aimGatesHelper}
          </p>
        )}

        {/* TYPE cards */}
        <div className="mt-3 font-mono text-[10px] uppercase tracking-spec text-steel">
          {c.aimGatesType}
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {TYPES.map(({ value, icon: Icon }) => {
            const on = type === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onPickType(value)}
                aria-pressed={on}
                className="flex flex-col items-center gap-1 rounded-sm border px-2 py-2.5 font-display text-[12px] font-semibold uppercase tracking-eyebrow transition-colors"
                style={
                  on
                    ? { borderColor: "#2F5D43", background: "#2F5D43", color: "#FCF9F1" }
                    : { borderColor: "rgba(22,18,13,0.2)", color: "#16120D" }
                }
              >
                <Icon size={18} strokeWidth={2.2} />
                {typeLabel(value)}
              </button>
            );
          })}
        </div>

        {/* WIDTH chips */}
        <div className="mt-3 font-mono text-[10px] uppercase tracking-spec text-steel">
          {c.aimGatesWidth}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {WIDTHS.map((w) => {
            const on = !isCustom && width === w;
            return (
              <button
                key={w}
                type="button"
                onClick={() => onPickWidth(w)}
                aria-pressed={on}
                className="h-10 min-w-[52px] rounded-pill border px-3 font-display text-[13px] font-semibold uppercase tracking-eyebrow transition-colors"
                style={
                  on
                    ? { borderColor: "#C99A3F", background: "#C99A3F", color: "#16120D" }
                    : { borderColor: "rgba(22,18,13,0.2)", color: "#16120D" }
                }
              >
                {w}
                {"'"}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onPickCustom}
            aria-pressed={isCustom}
            className="h-10 rounded-pill border px-3.5 font-display text-[13px] font-semibold uppercase tracking-eyebrow transition-colors"
            style={
              isCustom
                ? { borderColor: "#C99A3F", background: "#C99A3F", color: "#16120D" }
                : { borderColor: "rgba(22,18,13,0.2)", color: "#16120D" }
            }
          >
            {c.aimGatesCustom}
          </button>
        </div>

        {isCustom && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={3}
              max={12}
              step={0.5}
              value={Number.isFinite(customWidth) ? customWidth : ""}
              onChange={(e) => onCustomWidthChange(Number(e.target.value))}
              className="h-10 w-24 rounded-sm border border-navy/25 bg-paper px-3 font-display text-[15px] font-semibold text-navy focus:border-navy focus:outline-none"
              aria-label={c.aimGatesWidth}
            />
            <span className="font-mono text-[11px] uppercase tracking-spec text-steel">
              {c.aimFtUnit}
            </span>
            <button
              type="button"
              onClick={onApplyCustom}
              className="ml-auto flex h-10 items-center gap-1.5 rounded-sm bg-navy px-4 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-cream transition-colors hover:bg-navy/90"
            >
              <Check size={14} strokeWidth={2.5} />
              {c.aimGatesApply}
            </button>
          </div>
        )}

        {/* Deferred (priced-at-visit) — shown while choosing the spec. */}
        {deferred && (
          <div className="mt-3 flex items-start gap-2 rounded-sm border border-brass/40 bg-brass/10 px-3 py-2">
            <Info size={14} strokeWidth={2.5} className="mt-0.5 flex-shrink-0" style={{ color: "#8A6722" }} />
            <span className="font-body text-[12px] leading-[1.35] text-navy">
              {c.aimGatesDeferred}
            </span>
          </div>
        )}

        {/* Remove (edit mode only) */}
        {editing && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-sm border font-display text-[12px] font-semibold uppercase tracking-eyebrow transition-colors"
            style={{ borderColor: "#9E3B2E", color: "#9E3B2E" }}
          >
            <Trash2 size={14} strokeWidth={2.5} />
            {c.aimGatesRemove}
          </button>
        )}

        {/* Counter + Done */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-spec text-steel">
            {c.aimGatesCount.replace("{n}", String(count))}
          </span>
          <button
            type="button"
            onClick={onDone}
            className="flex h-11 items-center gap-1.5 rounded-sm px-5 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-cream transition-colors"
            style={{ background: "#2F5D43" }}
          >
            <Check size={15} strokeWidth={2.5} />
            {c.aimGatesDone}
          </button>
        </div>
      </div>
    </>
  );
}
