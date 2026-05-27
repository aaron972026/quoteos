"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Sparkles, X } from "lucide-react";

export interface QuotePhoto {
  url: string;
  uploadedAt: string;
}

export interface PhotoAudit {
  existing_fence_material: string | null;
  slope_estimate: string | null;
  obstacles: string[];
  suggested_demo_type: "NONE" | "CEDAR" | "CHAIN" | "METAL" | "CONC" | null;
  confidence: number;
  raw_notes: string;
  audited_at: string;
}

interface Props {
  quoteId: string;
  photos: QuotePhoto[];
  onChange: (photos: QuotePhoto[]) => void;
  /** Initial audit loaded from the quote row, if any. */
  initialAudit?: PhotoAudit | null;
  /** Max photos accepted (defaults to 3 — matches API). */
  max?: number;
}

const DEFAULT_MAX = 3;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const AUDIT_DEBOUNCE_MS = 2000;

export function PhotoUpload({
  quoteId,
  photos,
  onChange,
  initialAudit = null,
  max = DEFAULT_MAX,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<PhotoAudit | null>(initialAudit);
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditDismissed, setAuditDismissed] = useState(false);
  // Re-fire audit if the photo set changes after one was already run
  const auditedForUrlsRef = useRef<string>(
    initialAudit ? photos.map((p) => p.url).join("|") : ""
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (photos.length >= max) {
          setError(`Max ${max} photos per quote.`);
          break;
        }
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch(`/api/v1/quotes/${quoteId}/photos`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const body = await r.json().catch(() => null);
        if (!r.ok) {
          const msg = body?.error?.message ?? `Upload failed (${r.status})`;
          setError(msg);
          break;
        }
        if (Array.isArray(body?.photo_urls)) onChange(body.photo_urls);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(url: string) {
    setError(null);
    try {
      const r = await fetch(`/api/v1/quotes/${quoteId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setError(body?.error?.message ?? `Delete failed (${r.status})`);
        return;
      }
      if (Array.isArray(body?.photo_urls)) onChange(body.photo_urls);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  // Debounced auto-audit: wait until the user stops adding photos, then fire.
  // Skip if no photos, an upload is in progress, or we already audited the
  // current set. Re-fires if the photo set changes (different URL signature).
  useEffect(() => {
    if (uploading) return;
    if (photos.length === 0) return;
    const signature = photos.map((p) => p.url).join("|");
    if (signature === auditedForUrlsRef.current) return;

    const timer = setTimeout(async () => {
      setAuditing(true);
      setAuditError(null);
      try {
        const r = await fetch(`/api/v1/quotes/${quoteId}/audit`, {
          method: "POST",
          credentials: "include",
        });
        const body = await r.json().catch(() => null);
        if (!r.ok) {
          setAuditError(body?.error?.message ?? `Audit failed (${r.status})`);
          return;
        }
        if (body?.photo_audit) {
          setAudit(body.photo_audit as PhotoAudit);
          setAuditDismissed(false);
          auditedForUrlsRef.current = signature;
        }
      } catch (e) {
        setAuditError(e instanceof Error ? e.message : "Audit failed");
      } finally {
        setAuditing(false);
      }
    }, AUDIT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [photos, uploading, quoteId]);

  const canAddMore = photos.length < max && !uploading;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-navy">Yard photos (optional)</div>
        <div className="text-[10px] text-navy/50">
          {photos.length} / {max}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div
            key={p.url}
            className="relative h-20 w-20 overflow-hidden rounded-lg border border-navy/15 bg-navy/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="Yard" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => handleDelete(p.url)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/80 bg-navy/85 text-white hover:bg-navy"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-navy/25 bg-white text-navy/70 hover:border-accent hover:text-navy"
          >
            <Camera size={20} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Add
            </span>
          </button>
        )}

        {uploading && (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-navy/15 bg-navy/5">
            <Loader2 size={20} className="animate-spin text-navy/40" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-900">
          {error}
        </div>
      )}

      {/* Audit state — loader, error, or result card */}
      {auditing && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-navy/10 bg-navy/[0.02] px-3 py-2 text-xs text-navy/70">
          <Loader2 size={14} className="animate-spin text-accent" />
          Analyzing your photos…
        </div>
      )}

      {auditError && !auditing && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          Couldn&rsquo;t finish the photo analysis: {auditError}
        </div>
      )}

      {audit && !auditing && !auditDismissed && (
        <div className="mt-2 rounded-lg border border-accent/40 bg-accent/[0.06] px-3 py-2.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-navy">
              <Sparkles size={13} className="text-accent" />
              From your photos
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setAuditDismissed(true)}
              className="text-navy/40 hover:text-navy/70"
            >
              <X size={13} />
            </button>
          </div>
          <p className="mt-1 text-navy/75">{audit.raw_notes}</p>
          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-navy/60">
            {audit.existing_fence_material && (
              <>
                <dt className="font-medium">Existing</dt>
                <dd>{audit.existing_fence_material}</dd>
              </>
            )}
            {audit.slope_estimate && (
              <>
                <dt className="font-medium">Slope</dt>
                <dd>{audit.slope_estimate}</dd>
              </>
            )}
            {audit.suggested_demo_type && audit.suggested_demo_type !== "NONE" && (
              <>
                <dt className="font-medium">Demo</dt>
                <dd>{audit.suggested_demo_type}</dd>
              </>
            )}
            {audit.obstacles.length > 0 && (
              <>
                <dt className="font-medium">Obstacles</dt>
                <dd>{audit.obstacles.slice(0, 3).join(", ")}</dd>
              </>
            )}
          </dl>
          <div className="mt-1.5 text-[10px] italic text-navy/40">
            {Math.round(audit.confidence * 100)}% confidence
          </div>
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-navy/50">
        Snap a few shots of the yard — we&rsquo;ll use them to confirm scope.
      </p>
    </div>
  );
}
