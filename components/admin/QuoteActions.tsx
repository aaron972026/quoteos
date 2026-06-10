"use client";

import { useState, useTransition } from "react";
import { CreditCard, Mail, PencilRuler } from "lucide-react";
import {
  adjustQuotePrice,
  refundDeposit,
  resendQuoteEmail,
  type ActionResult,
} from "@/app/admin/quotes/actions";
import { formatCents } from "@/lib/utils";

interface Props {
  quoteId: string;
  status: string;
  customerEmail: string | null;
  selectedTierCents: number | null;
  depositCents: number | null;
  depositPaidAt: string | null;
  stripePaymentIntent: string | null;
}

export function QuoteActions({
  quoteId,
  status,
  customerEmail,
  selectedTierCents,
  depositCents,
  depositPaidAt,
  stripePaymentIntent,
}: Props) {
  return (
    <div className="space-y-4">
      <DepositPanel
        quoteId={quoteId}
        status={status}
        depositCents={depositCents}
        depositPaidAt={depositPaidAt}
        stripePaymentIntent={stripePaymentIntent}
      />
      <AdjustPanel
        quoteId={quoteId}
        status={status}
        selectedTierCents={selectedTierCents}
      />
      <ResendPanel quoteId={quoteId} customerEmail={customerEmail} />
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────

function ResultNote({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      className={
        "mt-2 rounded-md px-3 py-2 text-xs " +
        (result.ok
          ? "bg-green-50 text-green-900"
          : "bg-red-50 text-red-900")
      }
    >
      {result.message}
    </p>
  );
}

function PanelShell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-navy/10 bg-white p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-navy/70">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

// ─── Deposit / Stripe ───────────────────────────────────────────────────

function DepositPanel({
  quoteId,
  status,
  depositCents,
  depositPaidAt,
  stripePaymentIntent,
}: {
  quoteId: string;
  status: string;
  depositCents: number | null;
  depositPaidAt: string | null;
  stripePaymentIntent: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const paid = status === "deposit_paid" || status === "won";
  const refunded = status === "refunded";

  function submit() {
    const fd = new FormData();
    fd.set("quoteId", quoteId);
    fd.set("reason", reason);
    startTransition(async () => {
      const r = await refundDeposit(fd);
      setResult(r);
      if (r.ok) {
        setConfirming(false);
        setReason("");
      }
    });
  }

  return (
    <PanelShell icon={<CreditCard size={14} />} title="Deposit">
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-navy/60">Status</dt>
          <dd
            className={
              "font-semibold " +
              (paid
                ? "text-green-700"
                : refunded
                  ? "text-red-700"
                  : "text-navy/60")
            }
          >
            {refunded ? "Refunded" : paid ? "Paid" : "Not collected"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-navy/60">Amount</dt>
          <dd className="font-medium tabular-nums">
            {depositCents != null ? formatCents(depositCents) : "—"}
          </dd>
        </div>
        {depositPaidAt && (
          <div className="flex justify-between">
            <dt className="text-navy/60">Paid at</dt>
            <dd>{new Date(depositPaidAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</dd>
          </div>
        )}
        {stripePaymentIntent && (
          <div className="flex justify-between gap-2">
            <dt className="text-navy/60">Payment intent</dt>
            <dd className="truncate font-mono text-xs">{stripePaymentIntent}</dd>
          </div>
        )}
      </dl>

      {status === "deposit_paid" && stripePaymentIntent && (
        <div className="mt-3 border-t border-navy/5 pt-3">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
            >
              Refund deposit…
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-navy/60">
                Refunds the full deposit through Stripe and marks the quote
                refunded. A reason is required and audited.
              </p>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required) — e.g. customer cancelled before scheduling"
                className="w-full rounded-md border border-navy/15 px-3 py-1.5 text-sm placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending || reason.trim().length === 0}
                  onClick={submit}
                  className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-40"
                >
                  {pending ? "Refunding…" : "Confirm refund"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-md border border-navy/15 px-3 py-1.5 text-xs font-semibold text-navy/70 hover:bg-navy/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <ResultNote result={result} />
        </div>
      )}
      {!paid && !refunded && (
        <p className="mt-2 text-xs text-navy/40">
          Refund controls appear once a deposit is collected.
        </p>
      )}
    </PanelShell>
  );
}

// ─── Price adjustment ───────────────────────────────────────────────────

function AdjustPanel({
  quoteId,
  status,
  selectedTierCents,
}: {
  quoteId: string;
  status: string;
  selectedTierCents: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [newTotal, setNewTotal] = useState("");
  const [reason, setReason] = useState("");

  if (status === "won") {
    return (
      <PanelShell icon={<PencilRuler size={14} />} title="Adjust price">
        <p className="mt-2 text-xs text-navy/50">
          Quote is won — pricing now lives on the Housecall Pro job.
        </p>
      </PanelShell>
    );
  }

  function submit() {
    const fd = new FormData();
    fd.set("quoteId", quoteId);
    fd.set("newTotal", newTotal);
    fd.set("reason", reason);
    startTransition(async () => {
      const r = await adjustQuotePrice(fd);
      setResult(r);
      if (r.ok) {
        setNewTotal("");
        setReason("");
      }
    });
  }

  return (
    <PanelShell icon={<PencilRuler size={14} />} title="Adjust price">
      <p className="mt-2 text-xs text-navy/60">
        Overrides the customer-facing total (current:{" "}
        <span className="font-semibold tabular-nums">
          {selectedTierCents != null ? formatCents(selectedTierCents) : "—"}
        </span>
        ). Audited with reason. Re-send the email after so the PDF matches.
      </p>
      <div className="mt-3 space-y-2">
        <input
          value={newTotal}
          onChange={(e) => setNewTotal(e.target.value)}
          inputMode="decimal"
          placeholder="New total, e.g. 7250"
          className="w-full rounded-md border border-navy/15 px-3 py-1.5 text-sm placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required) — e.g. gate corrected W5→W4 after photo review"
          className="w-full rounded-md border border-navy/15 px-3 py-1.5 text-sm placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          disabled={pending || !newTotal.trim() || !reason.trim()}
          onClick={submit}
          className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save new price"}
        </button>
      </div>
      <ResultNote result={result} />
    </PanelShell>
  );
}

// ─── Re-send email ──────────────────────────────────────────────────────

function ResendPanel({
  quoteId,
  customerEmail,
}: {
  quoteId: string;
  customerEmail: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [to, setTo] = useState(customerEmail ?? "");

  function submit() {
    const fd = new FormData();
    fd.set("quoteId", quoteId);
    fd.set("to", to);
    startTransition(async () => {
      setResult(await resendQuoteEmail(fd));
    });
  }

  return (
    <PanelShell icon={<Mail size={14} />} title="Re-send quote email">
      <p className="mt-2 text-xs text-navy/60">
        Regenerates the PDF from the current numbers (including any admin
        override) and emails it.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          type="email"
          placeholder="customer@email.com"
          className="min-w-0 flex-1 rounded-md border border-navy/15 px-3 py-1.5 text-sm placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          disabled={pending || !to.trim()}
          onClick={submit}
          className="whitespace-nowrap rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-40"
        >
          {pending ? "Sending…" : "Send PDF"}
        </button>
      </div>
      <ResultNote result={result} />
    </PanelShell>
  );
}
