import Stripe from "stripe";

let _client: Stripe | null = null;

/**
 * Lazy-init Stripe client. Throws only when actually needed — lets
 * `next build` and unit tests run without STRIPE_SECRET_KEY set.
 */
export function getStripe(): Stripe {
  if (_client) return _client;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not set. See .env.example.");
  }
  _client = new Stripe(secret);
  return _client;
}

export const STRIPE_EVENTS = {
  CHECKOUT_SESSION_COMPLETED: "checkout.session.completed",
  CHECKOUT_SESSION_EXPIRED: "checkout.session.expired",
} as const;
