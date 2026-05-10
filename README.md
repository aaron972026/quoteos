# QuoteOS — FencePros Tulsa Instant Quote Tool

> Homeowner visits the site, types address, draws fence on satellite, picks style, sees an instant 3-tier price, and locks it in for $99 — without speaking to a human.

This is **Phase 1 foundation** built per the v1.0 spec. It includes:

- ✅ Next.js 14 (App Router) + TypeScript + Tailwind
- ✅ Pure-function pricing engine with **77 unit tests** (every SKU, slope, demo type, edge case)
- ✅ Postgres schema (Drizzle) for sessions, quotes, SKUs, adjustments, service zones, events
- ✅ Anonymous JWT sessions (HttpOnly cookie)
- ✅ Core API routes — sessions, pricing, quotes, SKUs, service zones
- ✅ Screen 1 (Landing) and Screen 2 (Address confirmation) with Google Places autocomplete
- ✅ Seed script for SKUs / adjustments / Tulsa metro service zones

Pending for next iterations: Map drawing (Screen 3), SKU configurator (Screen 4), Quote/Book (Screen 5), admin panel, Stripe deposit, Wisetack widget, GHL/HCP integrations, abandoned-cart workflows, PDF export.

---

## Quickstart

```bash
# 1. Install deps
npm install

# 2. Configure environment
cp .env.example .env.local
#    → fill in DATABASE_URL, SESSION_SECRET, NEXT_PUBLIC_GOOGLE_PLACES_KEY (others are stubs for now)

# 3. Generate & push schema, then seed
npm run db:generate
npm run db:push
npm run db:seed

# 4. Run the dev server
npm run dev
#    → http://localhost:3000
```

### Required env vars to boot

| Var | Why |
|---|---|
| `DATABASE_URL` | Any Postgres connection string. Supabase recommended. |
| `SESSION_SECRET` | ≥32 random bytes. `openssl rand -base64 48` |
| `NEXT_PUBLIC_GOOGLE_PLACES_KEY` | Optional — without it the address input degrades to a plain field. |

The other env vars (Stripe, Wisetack, GHL, etc.) are placeholders — they're consumed only when the corresponding screens / webhooks are wired up.

---

## Scripts

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run start        # Run prod build locally

npm run test         # Vitest watch mode
npm run test:run     # Vitest single run (CI)
npm run test:ui      # Vitest UI

npm run db:generate  # Generate migration SQL from schema
npm run db:push      # Push schema to DB (dev — bypasses migrations)
npm run db:studio    # Open Drizzle Studio
npm run db:seed      # Seed SKUs + adjustments + service zones
```

---

## Project structure

```
quoteos/
├── app/
│   ├── (public pages)
│   │   ├── page.tsx                 # Screen 1: Landing
│   │   └── address/page.tsx         # Screen 2: Address confirm
│   └── api/v1/
│       ├── sessions/init/route.ts   # Anonymous JWT session
│       ├── pricing/calculate/route.ts  # Pure pricing call
│       ├── quotes/route.ts          # POST: create draft
│       ├── quotes/[id]/route.ts     # GET / PATCH
│       ├── skus/route.ts
│       └── service-zones/[zip]/route.ts
├── components/
│   ├── ui/                          # Button, Input, Card primitives (shadcn-style)
│   ├── AddressAutocomplete.tsx      # Google Places integration
│   ├── ProgressDots.tsx
│   ├── SessionInit.tsx
│   └── TrustStrip.tsx
├── lib/
│   ├── api/                         # respond helpers, rate-limit, session helper
│   ├── auth/session.ts              # Anonymous JWT mint/verify (jose)
│   ├── db/
│   │   ├── schema.ts                # Drizzle schema
│   │   └── client.ts                # Lazy-init connection pool
│   └── pricing/
│       ├── engine.ts                # Pure pricing function — single source of truth
│       ├── engine.test.ts           # 77 unit tests
│       ├── data.ts                  # SKU + adjustment tables
│       └── types.ts
├── scripts/seed.ts                  # Seeds DB from lib/pricing/data.ts
├── drizzle.config.ts
├── vitest.config.ts
└── tailwind.config.ts               # Brand: navy #1F3A5F, accent #F4A623
```

---

## Pricing engine

The engine ([lib/pricing/engine.ts](lib/pricing/engine.ts)) is a pure function. Same input → same output, no I/O, no side effects. All money is in **integer cents**, never floats.

```ts
import { calculatePrice } from "@/lib/pricing/engine";

const result = calculatePrice({
  sku_code: "CP-B",
  linear_feet: 150,
  corner_count: 4,
  slope_code: 1,
  demo_type: "CEDAR",
  gates: [{ type: "SW-4", count: 1 }],
  height_upgrade: false,
  french_gothic: false,
  stain_seal: false,
});
// result.tiers.good   → { total_cents: 931_500,  monthly_24mo_cents: 42_980 }
// result.tiers.better → { total_cents: 1_099_170, monthly_24mo_cents: 50_716 }
// result.tiers.best   → { total_cents: 1_350_675, monthly_24mo_cents: 62_321 }
// result.internal_margin → { gross_margin_pct, margin_flag, ... }   ← server-only
```

**Critical:** before returning to a public client, run the result through `stripInternal()` so the `internal_margin` block (cost basis, margin %) never leaves the server. Both pricing routes already do this.

### Customizing prices

All SKUs, slope multipliers, demo rates, gate prices, tier multipliers, and add-ons live in [lib/pricing/data.ts](lib/pricing/data.ts). Edit there, run `npm run db:seed`, and changes propagate. The seed records a snapshot in `pricing_versions` so historical quotes stay reproducible.

---

## Test the pricing engine

```bash
npm run test:run lib/pricing/engine.test.ts
```

77 tests covering:

- Every SKU (15 — 5 families × 3 tiers)
- Every slope code (0–4)
- Every demo type (NONE, CEDAR, CHAIN, METAL, CONC)
- Every gate type (SW-4, SW-5, DD-10, DD-12, DD-14)
- Add-ons (stain, French Gothic, height upgrade, permit, HOA, travel)
- Corner pricing (first 4 free, $25 each over)
- PMT / monthly amortization
- Margin calculation against the spec example
- Validation errors (unknown SKU, negative LF, bad slope)
- Warnings (short run, long run, height upgrade on incompatible family)
- Output integrity (`stripInternal`, breakdown sums to good-tier)
- Snapshot test (golden — spec §5 example)

---

## Architecture notes

**Sessions** are anonymous from the start — a JWT cookie is minted on first visit (`POST /api/v1/sessions/init`). User identity is captured at the deposit step. This is what lets recovery emails / SMS work for abandoned quotes.

**Quotes** flow through statuses: `draft` → `finalized` → `deposit_paid` → `won` / `lost` / `expired`. The same row carries the geometry, SKU, options, and computed pricing snapshot — so admin can re-render any quote on a map after the fact.

**Pricing engine** is intentionally a pure function with no DB access. The seed script puts the data into Postgres for the admin panel to edit, but at runtime the engine reads from `lib/pricing/data.ts`. To swap to DB-driven config later, replace those imports with a cached DB lookup — same interface.

**Rate limits** are in-memory token-buckets ([lib/api/rate-limit.ts](lib/api/rate-limit.ts)) per spec §8: 30/min for pricing, 5/min for quote save, 1/min for deposit. For multi-instance deployment swap to Upstash Redis (same `checkLimit` signature).

---

## Deploy

Drop-in Vercel + Supabase setup:

1. Create a Supabase project → copy `DATABASE_URL` (Connection string → "Transaction" mode for serverless).
2. Push to GitHub → connect repo to Vercel → add env vars.
3. Run `npm run db:push && npm run db:seed` against the prod DB once.

Performance budgets per spec §7:
- Lighthouse ≥85 on 3G mobile
- TTI <3 s
- Map tile cache 24h

---

## What's next

Per spec §12 Phase 1 roadmap, in priority order:

1. **Screen 3 — Draw Fence Line.** mapbox-gl-draw + LF/corner counting. The differentiator.
2. **Screen 4 — Configure SKU.** Family cards → tier cards → add-ons.
3. **Screen 5 — Quote + Book.** 3-tier comparison + Stripe Checkout for $99 deposit + Wisetack widget.
4. **Webhooks** — Stripe `payment_intent.succeeded` → status update + Make.com fan-out to GHL/HCP.
5. **Admin panel** — quotes table, SKU manager, funnel analytics, margin watch.
6. **Quote PDF + email-me-this-quote (Resend).**
7. **Abandoned-cart workflows** (15-min, 1-hour, 24-hour SMS/email recovery).

Each of these is a tight, testable slice on top of the foundation in this repo.
