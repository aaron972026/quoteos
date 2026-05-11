import { Resend } from "resend";

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

/** From-address; defaults to a generic dev value so tooling doesn't crash. */
export function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? "FencePros <quotes@tulsafencepro.com>";
}
