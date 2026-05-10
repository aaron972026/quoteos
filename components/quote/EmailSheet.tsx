"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  quoteId: string;
  open: boolean;
  onClose: () => void;
}

export function EmailSheet({ quoteId, open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("That doesn't look like a valid email.");
      return;
    }
    startTransition(async () => {
      try {
        const r = await fetch(`/api/v1/quotes/${quoteId}/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 503) {
            throw new Error(
              body?.error?.message ?? "Email service isn't configured yet."
            );
          }
          throw new Error(body?.error?.message ?? "Couldn't send email");
        }
        setSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleClose() {
    setEmail("");
    setError(null);
    setSent(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/15 bg-white shadow-2xl"
      role="dialog"
      aria-label="Email me this quote"
    >
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-navy">
              {sent ? "Sent." : "Email me this quote"}
            </div>
            <div className="mt-0.5 text-xs text-navy/60">
              {sent
                ? "Check your inbox — PDF attached. Price held for 7 days."
                : "We'll send a PDF you can keep. No marketing emails."}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-full p-1 text-navy/60 hover:bg-navy/5"
          >
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-3 text-sm text-navy">
            <CheckCircle2 size={18} className="text-accent" />
            Sent to <span className="font-semibold">{email}</span>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1"
            />
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Sending…
                </>
              ) : (
                <>
                  <Mail size={18} /> Send PDF
                </>
              )}
            </Button>
          </form>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
