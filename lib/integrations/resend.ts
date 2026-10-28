import { Resend } from "resend";
import { BUSINESS } from "@/lib/business";

let _client: Resend | null = null;

/** Lazy-init Resend client. Throws only when actually used. */
export function getResend(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set. See .env.example.");
  }
  _client = new Resend(key);
  return _client;
}

/** From-address; defaults to the verified production sender. */
export function fromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL ?? "Ivory Fence Co. <quotes@ivoryfence.com>"
  );
}

/** Reply-to: the sending address has no inbox, so replies go to the business inbox. */
export function replyToAddress(): string {
  return process.env.RESEND_REPLY_TO ?? BUSINESS.email;
}
