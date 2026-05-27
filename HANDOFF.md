# QuoteOS — Handoff Context

**Last updated:** 2026-05-27
**Purpose:** Hand this file to a new Claude (or human collaborator) so they can pick up where the previous session left off without re-discovering the codebase.

---

## 1. What this is

**QuoteOS** is an instant-quote app for **FencePros Tulsa** — a fence-installation business. The product:

- Anonymous customer enters an address → confirms house on satellite map → draws fence line → picks family + tier → sees price → locks it in with a $99 refundable deposit.
- Target: address-to-deposit in **90 seconds, no sales call**.
- Brand domain: `fenceprostulsa.com` (Cloudflare Registrar). Repo not yet pushed to GitHub — still local-only at `C:\Users\Aaron\quoteos`.

**Owner:** Aaron — solo developer. Prefers terse exchanges, raised slice-budget ceilings, dislikes pausing on routine size violations.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14.2 App Router | `app/` routes, RSC by default |
| Language | TypeScript ≥ 5, `strict: true` | |
| Styling | Tailwind CSS + custom brand tokens (navy `#1A2A4A`, brick `#8B2332`, brass `#C8962E`, cream `#F4F1E8`, paper `#FBF8F0`) | Brand v1.0 palette |
| Fonts | next/font Oswald (display) + Source Sans 3 (body) + JetBrains Mono | |
| Database | Supabase Postgres via `postgres-js` + Drizzle ORM | Project ref in `DATABASE_URL` |
| Map | Mapbox GL JS + mapbox-gl-draw | Satellite imagery + custom draw layers |
| Geocoding | Google Places (PlaceAutocompleteElement web component) | Dynamic library bootstrap, not eager script |
| Parcels | **Tulsa County GIS** primary + Regrid fallback | Free + authoritative for Tulsa proper |
| Elevation | USGS EPQS (point lookups) | For slope-detect, free |
| Sessions | jose JWT in `qos_session` cookie | |
| Magic links | jose JWT with `m:1` marker, separate cookie | SMS recovery flow |
| Payments | Stripe Checkout (test mode for now) | |
| Email | Resend | For "email this quote" PDF |
| SMS | Twilio REST API (no SDK) | Abandoned-cart recovery |
| PDF | @react-pdf/renderer | Quote PDF + BOM PDF + briefing PDF |
| AI | Anthropic SDK 0.95 (Opus 4.7) | Photo audit (deferred slice) |
| Financing copy | Wisetack pre-qual URL | Soft pull, no commission tracking yet |
| Permission gate | Custom middleware on `/admin/*` | Basic Auth + IP allowlist |

---

## 3. Where We Are

**Phase 1 (MVP funnel):** ✅ done — 6 screens, working pricing, draft/finalized/deposit states.

**Brand v1.0 redesign (Slices A–G):** ✅ done — full visual + copy rebuild against the `_design/design_handoff_quoteos_funnel/` spec. Color tokens, fonts, brand components (`Header`, `Footer`, `Eyebrow`, `TrustBar`, `StarCoin`, `SatellitePreview`, etc.), all 5 funnel screens.

**Pricing model v2:** ✅ done — switched from old "good/better/best multiplier" engine to **cost-up to target margin** model per the FencePros pricing spreadsheet (`_pricing/FencePros_Pricing_Model.csv-*`). Includes margin-floor + min-profit guards, $50 rounding, swing-clamped display range.

**Catalog reshuffle:** ✅ done — 5 families × 1-3 SKUs each (9 SKUs total):
| Family | Good | Better | Best |
|---|---|---|---|
| Budget Pine (BP) | BP-STD | — | — |
| Cedar Privacy (CPF) | — | CPF-PRM | CPF-EST |
| Horizontal Cedar (HCF) | — | HCF-STD | HCF-PRM |
| Chain Link (CL) | CL-RES | CL-VIN | — |
| Ranch Rail (RR) | RR-3 | RR-4 | — |

**Static content pages:** ✅ done — `/materials` and `/warranty` long-form pages, linked from Header + Footer.

**Slices since the previous handoff (full session log at bottom):**
1. Engine rewrite (cost-up math + guards + $50 round + swing clamp)
2. API + DB + UI cascade to new pricing shape
3. Drop 2-rail SKUs; family→tier→customize UI
4. Friendlier names + permits "incl." + warranty rewrite (2yr workmanship · 5yr post · 15yr structural · 12mo no-warp · 1yr hardware)
5. Hide internal margin-floor adjustment from customer
6. BIG GOOD/BETTER/BEST label hierarchy; family chip row → 5 big cards w/ sketches
7. Budget Pine as separate family; pine sketch SVG
8. Materials + Warranty pages
9. Insurance Claim section on landing; TrustBar → "Xactimate Certified" + "Locally Owned & Operated"; Footer drops "EST. 2003"
10. Cap rail + match-black-vinyl-posts toggles; BP gets steel upgrade; family-aware trust card; 100-lb concrete clarification; Wisetack widget restored

---

## 4. Pricing Model v2 — must read

Pricing source: `_pricing/FencePros_Pricing_Model.csv-*` exports (sku-pricing, add-ons, assumptions, job-estimator).

**File hierarchy:**
- [lib/pricing/types.ts](lib/pricing/types.ts) — `PricingInput` / `PricingResult` / `PricingBreakdown` / `InternalMargin`
- [lib/pricing/data.ts](lib/pricing/data.ts) — `ASSUMPTIONS` / `SKUS` / `SLOPE` / `GATE_PRICES` / `ADDONS` / `PERMITS` / `STEEL_UPGRADE_FAMILIES` / `CAP_RAIL_FAMILIES`. Single source of truth.
- [lib/pricing/engine.ts](lib/pricing/engine.ts) — pure `calculatePrice(input, config)`
- [lib/pricing/load-config.ts](lib/pricing/load-config.ts) — currently returns file constants; DB-backed config deferred until SKU schema gets the new columns (label_cost / market_max / market_flag / posts_standard) populated by an admin UI
- [lib/pricing/engine.test.ts](lib/pricing/engine.test.ts) — 50+ Vitest cases pinning the CSV worked example end-to-end

**Math:**

```
price/LF       = (material × 1.05 waste + labor + $3 overhead) / (1 - 0.45 target margin)
slope-adj/LF   = price/LF × (1 + slope_pct)
access-adj/LF  = slope-adj/LF × (1 + 0.08 if difficult_access else 1)
fence subtotal = access-adj × LF
+ steel upgrade (+$5/LF, cedar/horizontal/pine wood-post families)
+ cap rail + trim (+$4/LF, wood-picket families)
+ match black vinyl posts (+$3/LF, CL-VIN only)
+ gates (sum: count × $350/$425/$850/$1,100/$1,750)
+ demo ($3/LF when demo_type != NONE)
+ stain ($8/LF)
+ rock drilling ($25/post)
+ tear concrete posts ($20/post)
+ permit (city-keyed: Tulsa/BA/Bixby/Jenks $75, Owasso $0)
= raw_subtotal

GUARDS (raise price only, never lower):
- margin floor: price ≥ cost / (1 - 0.38)
- min profit:   price ≥ cost + $800
The guard delta is absorbed into the base_fence line on the customer-
facing invoice — never labeled as "margin adjustment". Internal-only.

ROUND to nearest $50.

SWING (customer-facing display range):
swing = clamp(0.05 × final, $200, $1200)
display_range = [final - swing, final]
```

**Slope mapping:**
| Code | Surcharge | Notes |
|---|---|---|
| 0 | 0% | Flat |
| 1 | 5% | Mild |
| 2 | 12% | Moderate |
| 3 | 18% | Steep (was 22% in CSV; lowered to 18%) |
| 4 | 18% + warning | Severe — emits `slope_review_required` |

**Gate types (renamed in v2):** `W4 / W5 / D10 / D12 / D16` (was `SW-4 / SW-5 / DD-10 / DD-12 / DD-14`).

**Tier slot map** (drives the `/configure` GOOD/BETTER/BEST cards):

The `tier` column on the `skus` table was repurposed from "good/better/best multiplier" → "slot label" — see `LEGACY_TIER` map in [scripts/seed.ts](scripts/seed.ts).

**Warranty rules** (per `_pricing/.../FencePros Promise` doc; see `/warranty` page):
- 2-year workmanship (transferable)
- 5-year cedar post · structural failure
- 15-year structural with PostMaster+ steel upgrade · 130 mph wind rated
- 12-month no-warp on KDAT pine
- 1-year gate hardware
- 2-year stain when FencePros-applied
- Manufacturer pass-through on materials

These warranty terms are **reflected in spec bullets, trust card inclusions, landing copy, materials/warranty pages**. Search "warranty" if you change them.

---

## 5. Routes / UI Pages

**Customer funnel** (in order):
- [/](app/page.tsx) — landing (hero · 3-step explainer · reasons · FAQ · Insurance Claim band · final CTA)
- [/address](app/address/page.tsx) — Google Places autocomplete (`Step 1`)
- [/address/confirm](app/address/confirm/page.tsx) — satellite confirm + ownership gate (`Step 2`)
- [/draw](app/draw/page.tsx) — Mapbox satellite + draw line + click-through onboarding modal + gate placer + slope auto-detect + photo upload + neighbor parcels (`Step 3`)
- [/configure](app/configure/page.tsx) — 5 family cards → GOOD/BETTER/BEST per family → Customize toggles (stain · steel posts · cap rail · vinyl posts) → sticky estimate (`Step 4`)
- [/quote/[id]](app/quote/%5Bid%5D/page.tsx) — price range card + lock-in + invoice + schedule preview + Wisetack widget + family-aware trust card + reviews (`Step 5`)
- [/quote/[id]/success](app/quote/%5Bid%5D/success/page.tsx) — post-Stripe return

**Static pages:**
- [/materials](app/materials/page.tsx) — 7 material sections (cedar, KDAT pine, chain link, posts, concrete, fasteners, stain)
- [/warranty](app/warranty/page.tsx) — At-a-glance + 10 numbered sections from the FencePros Promise

**Admin** (Basic Auth via middleware):
- [/admin](app/admin/page.tsx) — dashboard
- [/admin/quotes](app/admin/quotes/page.tsx) — list + filters
- [/admin/quotes/[id]](app/admin/quotes/%5Bid%5D/page.tsx) — detail + margin panel + BOM download
- [/admin/skus](app/admin/skus/page.tsx) — SKU list
- [/admin/skus/[code]/edit](app/admin/skus/%5Bcode%5D/edit/page.tsx) — edit a SKU
- [/admin/funnel](app/admin/funnel/page.tsx) — funnel + SKU mix
- [/admin/abandoned](app/admin/abandoned/page.tsx) — recovery tracker

**API:**
- `POST /api/v1/sessions/init` — anonymous session cookie
- `GET /api/v1/skus` — flat SKU list (DB rows enriched with `displayName` from file constants)
- `POST /api/v1/quotes` — create quote
- `GET /api/v1/quotes/[id]` — read quote (strips margin fields)
- `PATCH /api/v1/quotes/[id]` — update + recompute pricing
- `POST /api/v1/quotes/[id]/lock-in` — Stripe checkout
- `POST /api/v1/quotes/[id]/email` — email PDF
- `GET /api/v1/quotes/[id]/recover/[token]` — magic-link recovery
- `POST /api/v1/pricing/calculate` — stateless pricing preview
- `POST /api/v1/elevation/slope-detect` — USGS-backed slope
- `POST /api/v1/parcels/lookup` — Tulsa GIS / Regrid parcel + neighbors
- `GET /api/v1/service-zones/[zip]` — zone gate
- `POST /api/v1/photos/upload` — Supabase Storage upload
- `POST /api/v1/photos/audit` — Anthropic vision pass
- `POST /api/v1/auth/magic` — issue magic link
- `GET /api/admin/quotes/[id]/bom?format=pdf|json` — BOM render
- `POST /api/webhooks/stripe` — deposit confirmation
- `GET /api/cron/abandoned-cart` — 15m / 1h / 24h SMS+GHL nudges
- `GET /api/cron/material-index` — FRED index check

---

## 6. Where things live

```
app/
├── page.tsx                         # Landing
├── layout.tsx                       # next/font wiring (Oswald + Source Sans 3 + JetBrains Mono)
├── globals.css                      # Brand utilities (.dashes, .pickets, address autocomplete fixes)
├── address/page.tsx
├── address/confirm/page.tsx
├── draw/page.tsx
├── configure/page.tsx
├── quote/[id]/page.tsx
├── quote/[id]/success/page.tsx
├── materials/page.tsx               # New
├── warranty/page.tsx                # New
├── admin/
└── api/

components/
├── brand/                           # Header · Footer · Eyebrow · TrustBar · StarCoin · Progress · TextInput · SatellitePreview · DrawHelpModal
├── configure/                       # FamilyCard · AddonRow · FenceSketch
├── quote/                           # QuoteCountdown · EmailSheet · WisetackWidget
├── draw/                            # PhotoUpload · NeighborPanel
├── map/                             # FenceMap · GatePlacer · DrawingHud · SlopeSelfReport · DemoToggle
├── admin/                           # MarginPanel · QuotesTable · etc.
├── ui/                              # button · input · label · progress · radio-group (shadcn)
├── AddressAutocomplete.tsx          # Google Places web component wrapper
├── BrandMark.tsx                    # Logo with text fallback
├── LocaleToggle.tsx
└── SessionInit.tsx                  # Issues anon session cookie

lib/
├── pricing/                         # Engine + types + data + tests + load-config
├── db/                              # Drizzle schema + client
├── i18n/                            # Dictionaries (EN + ES) + server/client helpers
├── api/                             # respond · rate-limit · session-helper
├── pdf/                             # QuotePdf · BomPdf · BriefingPdf · brand-logo
├── bom/                             # Generator + types + tests
├── integrations/                    # ghl · resend · twilio · stripe · regrid · tulsa-gis · fred · mapbox · usgs
├── experiments/                     # A/B variant assignment (Phase 1.5)
├── material-index/                  # FRED commodity tracking
├── magic-link/                      # JWT issuer/verifier
├── map/                             # linear-feet · self-intersect helpers
└── business.ts                      # BUSINESS constants (name, phone, email, etc.)

scripts/
├── seed.ts                          # Idempotent — npm run db:seed
├── migrate-skus-v2.ts               # One-shot ALTER TABLE — bypasses drizzle-kit when it chokes on CHECK constraints
└── check-pricing.ts                 # CLI verifier — reproduces CSV worked example

_design/design_handoff_quoteos_funnel/    # Original brand spec from Claude design
_pricing/                                  # FencePros pricing model CSVs (source of truth for engine)
```

---

## 7. Environment

`.env.local` at repo root. Notable vars (see `.env.example`):

- `DATABASE_URL` — Supabase pooler URL
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Storage uploads
- `NEXT_PUBLIC_MAPBOX_TOKEN` — Mapbox public key
- `NEXT_PUBLIC_GOOGLE_PLACES_KEY` — Google Places (HTTP referrer-restricted; `http://localhost:3000/*` must be on the allowlist)
- `REGRID_API_KEY` — fallback parcels
- `ANTHROPIC_API_KEY` — photo audit (cannot be re-fetched after creation — one-time-show)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — payment
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — email
- `GHL_API_KEY`, `GHL_INBOUND_WEBHOOK_URL`, `GHL_LOCATION_ID` — CRM
- `SESSION_SECRET` — JWT signing
- `ADMIN_PASSWORD_HASH`, `ADMIN_IP_ALLOWLIST` — admin gate
- `NEXT_PUBLIC_WISETACK_PREQUAL_URL` — financing link
- `MAKE_HCP_WEBHOOK_URL` — HousecallPro integration
- `NEXT_PUBLIC_SITE_URL` — used by Stripe + magic link return URLs

---

## 8. DB / Schema

Drizzle declarative schema at [lib/db/schema.ts](lib/db/schema.ts). Sync via:

```powershell
npm.cmd run db:push -- --force
```

If drizzle-kit chokes (rare; it happened once on a CHECK constraint), fall back to:

```powershell
npx.cmd dotenv -e .env.local -- tsx scripts/migrate-skus-v2.ts
```

Then re-seed:

```powershell
npm.cmd run db:seed
```

**Recently applied v2 migration** (already in prod-dev): added `labor_cost_per_lf_cents`, `market_max_per_lf_cents`, `market_flag`, `posts_standard` to `skus`; made `tier` and `sub_labor_pct` nullable.

**Quotes table still has legacy columns** (`tier_good_cents`, `tier_better_cents`, `tier_best_cents`, `tier`) — the engine writes `final_price_cents` to all of them for read-side backward compat. Drop them in a future schema slice when no consumer references them.

---

## 9. How to run

```powershell
# install
npm.cmd install

# dev server (port 3000; will fall back to 3001 if taken)
npm.cmd run dev

# pricing engine sanity check (matches CSV worked example)
npx.cmd tsx scripts/check-pricing.ts CPF-PRM 150 1 Tulsa 1 0
# expected: final $7,500 (with $350 W4 gate per add-ons sheet; CSV says
# $7,600 with their internal $450 walk-gate — gate-price gap, documented)

# verify
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:run        # 117 tests
```

Dev server expects port 3000 because the Google Places key has it on the HTTP-referrer allowlist. If a stale node process is on 3000, kill it:

```powershell
$pid = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($pid) { Stop-Process -Id $pid -Force }
```

---

## 10. Known gotchas + conventions

**Address autocomplete blanks its own input.** Google's `<gmp-place-autocomplete>` web component clears the input string the moment the customer picks a suggestion. We mitigate with a brand "Located · ..." chip rendered below the input — see [app/address/page.tsx](app/address/page.tsx#L194).

**Customer never sees internal pricing logic.** `pricing.guards_applied` and `internal_margin` exist on the engine result but are stripped at the `/api/v1/pricing/calculate` boundary (`stripInternal()`) and not rendered on `/quote`. The guard-delta is absorbed into the base-fence invoice line rather than labeled.

**Permits + buried-line inspection always render as "incl."** on the `/quote` invoice — even though the $75 permit cost is real and folded into the total. The customer never sees a $75 line item that could trigger pushback.

**Family-aware trust card.** The "Materials" inclusion row on `/quote` swaps text based on `quote.family`:
- Cedar/Horizontal/Ranch → "Western Red Cedar, Graded"
- Budget Pine → "KDAT Pine, Hand-Selected"
- Chain Link → "Galvanized + PVC-Coated Mesh"

**SKU codes are internal.** Customers see `displayName` ("Cedar Premium", "KDAT Premium Pine", etc.) — the underlying `CPF-PRM` / `BP-STD` codes only appear in admin + the quote spec line.

**Phone/email are in `lib/business.ts`.** Never hardcode `(918) ...` anywhere. Same for `BUSINESS.legalName`, `BUSINESS.domain`, `BUSINESS.city`. Never hardcode an "established year" — owner prefers we don't disclose it; if forced, use 2026.

**Mapbox & secret keys.** Never echo back the service-role key or any secret. They live in env vars only. Anthropic key can't be re-fetched after creation.

**Insurance lead routing.** The landing-page Insurance Claim section uses a `mailto:` link with subject `Insurance Claim — FencePros Tulsa` and a pre-filled body asking for address, date of loss, carrier, claim number. Subject line is the tag — anything hitting that subject in `quotes@fenceprostulsa.com` should be routed to the insurance queue.

**Dictionary still has legacy keys.** `configure.tierGood/tierBetter/tierBest/mostPicked/tierBetterBadge` exist in dictionaries.ts but a couple are unused. Harmless; cleanup deferred.

**HOA mention removed.** Per owner direction, no HOA mention in customer-facing copy. Permits are described as "we cover permits on every job" — no per-job paperwork fee.

---

## 11. Recent work log (since 2026-05-12 handoff)

**Engine + catalog rewrite (Slices 1–3):**
- Pricing v2 — cost-up to 45% target margin, 38% floor guard, $800 min-profit guard, $50 rounding, swing-clamped display range
- Gate codes renamed W4 / W5 / D10 / D12 / D16
- Family codes renamed: dropped OR (Ornamental), added BP (Budget Pine)
- 9 SKUs (down from 15) across 5 families
- 2-rail variants retired (CPF-STD, RR-2)
- Schema migration: added labor_cost_per_lf_cents · market_max_per_lf_cents · market_flag · posts_standard to skus
- `npm run db:seed` cleanup loop deletes obsolete SKU codes from DB

**UI restructure:**
- Family chip row → 5 large cards w/ fence-style sketches
- GOOD / BETTER / BEST tier labels are now dominant (32px Oswald)
- "Most Picked" badge on Better slot
- Customize section gated after tier pick
- Friendly display names (KDAT Premium Pine, Cedar Premium, Cedar Estate, Horizontal Cedar, Horizontal Premium, Galvanized Residential, Vinyl-Coated Black, 3-Rail Ranch, 4-Rail Ranch + Mesh)
- New pine fence sketch SVG

**Warranty + copy:**
- Full warranty rewrite per FencePros Promise doc — affects spec bullets, trust card inclusions, landing reassurance, materials page, footer
- TrustBar: "Licensed" → "Xactimate Certified" · "Family-Owned" → "Locally Owned & Operated"
- Address lead: "Pick your cedar" → "Pick your material"
- Landing reasons: dropped "ornamental"; added KDAT pine
- FAQ: dropped HOA mention; permits framed as "covered on every job"
- Footer: removed EST. 2003

**Customization toggles:**
- Stain & Seal · +$8/LF
- Steel Post Upgrade (PostMaster+) · +$5/LF · cedar/horizontal/pine
- Cap Rail + Trim · +$4/LF · wood-picket families
- Match Black Vinyl Posts · +$3/LF · CL-VIN only

**Customer-facing invoice changes:**
- Permits + Buried Line Inspection (OK811) rendered as "incl." rows (not itemized as $75)
- Hidden margin-floor / min-profit guard adjustment from customer view
- Family-aware "Materials" trust-card row
- Concrete row reads "~100 lbs of 3,000-psi concrete per post"
- Wisetack widget restored under schedule preview
- "Buried Line Inspection (OK811)" appears alongside Permits as informational

**New pages:**
- `/materials` — 7 material sections w/ spec cards
- `/warranty` — FencePros Promise w/ at-a-glance + 10 sections (internal attorney-review note intentionally NOT rendered)
- Linked from Header (Materials · Warranty) + Footer (Materials · Warranty · Get A Quote)

**Insurance Claim band on landing:**
- Cream-deep card between FAQ and Final CTA
- Brick-shield icon · "Storm Damage · Insurance Claim" eyebrow
- "Fence Hit By A Storm? We Handle The Claim." headline
- Xactimate-certified messaging + adjuster coordination
- CTAs: Call Storm Line (brick button) + mailto with pre-filled "Insurance Claim — FencePros Tulsa" subject for lead routing

---

## 12. Open items / next steps

**Schema cleanup (not urgent):**
- Drop legacy columns from `quotes`: `tier`, `tier_good_cents`, `tier_better_cents`, `tier_best_cents`. Engine writes `final_price_cents` to all of them — read-side compat only. Drop when no admin/PDF/integration reads them.
- Dictionary cleanup: remove unused `configure.tierGood/tierBetter/tierBest/mostPicked` keys.

**Optional polish:**
- Warranty PDF — add the 10-section warranty to the QuotePdf attachment (currently the email PDF only shows invoice + scope).
- PDF rendering: confirm PostMaster+ section reads correctly on the BOM PDF when steel-upgrade is on.
- Wisetack monthly: the WisetackWidget now receives `monthly_24mo_cents` from the engine. Spot-check the math (9.99% APR / 24 mo amortization) against actual Wisetack monthly quotes.
- Tier slot map: BP family only has 1 SKU (Good). If you want a "Better" BP variant later (premium KDAT, taller, etc.), it slots into `BP-???` with tier=`"better"` in seed.ts.

**Branding TBD:**
- Brand logo files (logo.svg / logo.png / icon.png / logo-icon.svg) live in `public/`. SVG path drawn in [components/brand/BrandMark.tsx](components/brand/BrandMark.tsx). Text fallback wired.
- Real product photography hasn't been shot — every `heroImageUrl` is null. The fence-style SVG sketches stand in until you have product photos. Slot is `skus.heroImageUrl` in the DB.

**Phase 2 ideas captured but not built:**
- Estimator briefing PDF (interior-only, for the install crew)
- Materials BOM generator (already exists at `lib/bom/generator.ts` but not surfaced to crew yet)
- Lumber/material commodity index banner (already exists in `lib/material-index/`)
- Neighbor-split detection on adjacent parcels (UI surface exists, no backend trigger)
- Variant funnel pivot (A/B framework already exists at `lib/experiments/`)

**Deploy:**
- Repo still local. To go live: `git init` → push to GitHub → connect to Vercel → set env vars in Vercel UI → run Drizzle migration against production Supabase project.

---

## 13. Workflow conventions ([CLAUDE.md](CLAUDE.md) is the source of truth)

- Slice Loop: INTAKE → PLAN → EXECUTE → VERIFY → REPORT
- Hard-stop ceilings raised per owner preference for QuoteOS — don't pause on routine size violations (10+ files / 500+ LOC / 3+ new deps still pause)
- Pricing engine tests must stay green on every pricing-related change
- Money in cents, never floats
- Throw `PricingError(code, message)` not raw `Error`
- Validate API input with Zod at the boundary; strip internal margin via `stripInternal()` before returning to public clients
- File path references format: `path/to/file.ts:42`
- No emojis in code or filenames
- Don't push to remote, force-push, create commits, or delete branches unless asked
