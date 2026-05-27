# Handoff: QuoteOS — FencePros Instant-Quote Funnel

## Overview

QuoteOS is the 5-screen instant-quote funnel for **FencePros**, a premium fence company in Tulsa, OK. A homeowner enters their address, confirms their house on a satellite map, draws their fence line, picks a style, and locks the price with a $99 refundable deposit. **Target: address-to-deposit in 90 seconds, no sales call.**

This handoff bundle contains the redesigned visual layer for an existing functional app. The functionality (Google Places autocomplete, Mapbox drawing, pricing engine, Stripe deposit) is already wired in the real codebase — **your job is to apply the design layer**, not rebuild the logic.

## About the Design Files

The files in `source/` are **design references created in HTML/React/Babel** running on a Tailwind CDN. They are prototypes showing intended look and behavior — **not production code to copy verbatim**.

Your task is to **recreate these designs in the target FencePros codebase**:
- **Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, Mapbox GL JS + mapbox-gl-draw
- **5 routes:** `/address`, `/address/confirm`, `/draw`, `/configure`, `/quote`
- **State:** No `localStorage` / `sessionStorage` — funnel state lives in React Context or session cookies (production already uses session cookies). The prototype uses lifted React state.

Translate the prototype's components into the codebase's existing patterns. The Tailwind config in `tokens/tailwind.config.ts` is production-ready — drop it in.

## Fidelity

**High-fidelity.** Pixel-perfect mockups with final colors, typography, spacing, shadows, micro-interactions, and copy. Recreate exactly. Brand colors, font weights, tracking values, and component states are non-negotiable — they came from the FencePros Brand Guidelines v1.0 (also in `source/`).

The existing app uses placeholder tokens `navy #1F3A5F` and `gold #F4A623` — **these are wrong**. Replace with the exact brand palette in `tokens/tailwind.config.ts` (`#1A2A4A` navy, `#C8962E` brass).

---

## Brand System — Strict Compliance

### Color Tokens (Tailwind classes)

| Token         | Hex       | Use                                                                                       |
| ------------- | --------- | ----------------------------------------------------------------------------------------- |
| `navy`        | `#1A2A4A` | **Primary surface.** Hero blocks, headers, footers, where the badge lives.                |
| `navy-deep`   | `#121C33` | Gradients, footer base.                                                                   |
| `navy-soft`   | `#2A3A5C` | Hover states on navy.                                                                     |
| `brick`       | `#8B2332` | **EMPHASIS ONLY.** CTA buttons, price numerals, "PROS" half of the wordmark, error states. Never a large background block. *"Brick is a stamp, not a wall."* |
| `brick-deep`  | `#6E1A26` | CTA hover.                                                                                 |
| `brass`       | `#C8962E` | **TRIM ONLY.** Rules, dashes, borders, picket motifs, tagline on dark. Never readable body text on cream (fails contrast 2.3:1). *"Brass is a finish, not a paint."* |
| `brass-soft`  | `#E0B452` | Subtle decorative variants.                                                                |
| `cream`       | `#F4F1E8` | **Paper surface** on light screens. Never substitute pure white.                          |
| `cream-deep`  | `#E9E4D3` | Subtle dividers / inset surfaces.                                                          |
| `paper`       | `#FBF8F0` | Warmer-than-cream page background, used for input fields and cards on light screens.       |
| `ink`         | `#15161A` | **Body text on cream.**                                                                    |
| `char`        | `#2C2F36` | Secondary text (paragraphs under leads).                                                   |
| `steel`       | `#6B6F76` | Captions, helper text, muted labels.                                                       |
| `steel-soft`  | `#A7ABB2` | Disabled controls, mist.                                                                   |

**Approved text pairings (WCAG):**
- Ink on Cream — AAA 14.4:1 — default body
- Cream on Navy — AA 11.8:1 — dark blocks, hero
- Brick on Cream — AA 6.4:1 — emphasis, safe at 16px+
- Cream on Brick — AA 8.2:1 — primary CTA
- Brass on Navy — LARGE only 4.6:1 — taglines/eyebrows ≥18px
- **NEVER:** Brass on Cream (2.3:1), Brick on Navy (1.9:1) for any text

### Typography

| Font            | Use                                                                | Weights         |
| --------------- | ------------------------------------------------------------------ | --------------- |
| **Oswald**      | All display, headlines, eyebrows, all-caps labels, buttons, signage, the price | 400 / 500 / 600 / 700 |
| **Source Sans 3** | All body copy, paragraphs, helper text, form inputs              | 300 / 400 / 600 / 700 |
| **JetBrains Mono** | Spec lines only — quote numbers, linear footage, e.g. `QUOTE #FP-2026-04812 · 142 LF · CEDAR · 6FT` | 400 / 500 |

**Tracking rules:**
- Caps at small sizes (<24px): track `+0.06em` to `+0.12em` (`tracking-eyebrow` token)
- Display sizes (>56px): tight, `-0.01em` (`tracking-tightest` token)
- Spec/mono labels: `+0.18em` (`tracking-spec` token)

**One Display headline per screen, max.** No italics — use weight or color for emphasis. No serifs anywhere.

### Type Scale

| Role           | Font + Weight     | Size  | Line height | Tracking | Tailwind class      |
| -------------- | ----------------- | ----- | ----------- | -------- | ------------------- |
| H1 hero/cover  | Oswald 700        | 84px  | 0.95        | -0.01em  | `text-d-h1` UPPER   |
| H2 section     | Oswald 700        | 56px  | 1.0         | +0.02em  | `text-d-h2` UPPER   |
| H3 sub         | Oswald 700        | 28px  | 1.1         | +0.06em  | `text-d-h3` UPPER   |
| H4 eyebrow     | Oswald 600        | 18px  | 1.2         | +0.12em  | `text-d-h4` UPPER   |
| Lead           | Source Sans 3 400 | 21px  | 1.5         | —        | `text-lead` `text-char` |
| Body           | Source Sans 3 400 | 16px  | 1.55        | —        | `text-body` `text-ink`  |
| Small/caption  | Source Sans 3 400 | 13px  | 1.5         | —        | `text-small` `text-steel` |
| Mono spec      | JetBrains Mono    | 13px  | —           | +0.18em  | `font-mono tracking-spec text-brick uppercase` |

### Logo & Marks

- **Horizontal lockup** in the funnel header: badge mark left, wordmark right (`FENCE` in navy, `PROS` in brick). Minimum height 48px digital.
- **Star Coin** (star roundel on navy with brass ring) for favicons / loaders / tiny placements. Never crop the full shield into a circle.
- **Badge SVG in the prototype is a placeholder** — replace with the real FencePros badge PNG/SVG asset. The shield shape is a tall heraldic vertical — `200 × 236` viewBox ratio in the prototype.

### Recurring Motifs

1. **Dashes flourish** (`.dashes` utility in `tokens/brand.css`) — short brass dash + long brass dash flanking eyebrow labels. Used to introduce headlines. See `Eyebrow` component.
2. **Pickets** — small brass pentagon-topped bars (`.pickets` utility) used as footer flourish and tier-quality indicator.

### Voice — Microcopy Rules

**Use:** Built, Stands, Plumb, Square, Warranty, Concrete-set, Cedar-graded, Neighborly, Honest, Heritage, Storm-ready, Weatherproofed, Posts, Workmanship, Craft, Quoted, Scheduled, Installed, Family-owned, Tulsa, Oklahoma, Fifteen-Year, Reliable, Premium.

**Never use:** Cheap, Affordable, Deal, Bargain, Sale, Discount, Hurry, "Limited time!", Slay, Amazing, Awesome, Vibe, Disrupting, Game-changing, Solutions, Synergize, Best-in-class, World-class, Y'all, Howdy, Yeehaw, Lit, Crushing it, "Cheaper than." **No folksy clichés.**

**Approved taglines:**
- Primary: **"Built Right. Stands Strong."**
- Storm: "After the storm, before the next."
- Materials: "Cedar that knows the Oklahoma sky."
- Warranty: "Fifteen years. One handshake."

---

## Screens

### 1. `/address` — Hero Entry

**Purpose:** First impression. Convert ad-traffic visitor into a funnel-starter in one action.

**Layout (desktop):**
- `<Header />` (paper background, lockup left, phone right) — 68px tall
- `<Progress />` step indicator (step 0 = current) — 56px tall
- Hero section: centered column, max-width 820px, vertical padding 96px top / 112px bottom
  - Eyebrow with dashes flourish: **"Built Right · Stands Strong"**
  - H1 (88px Oswald 700, uppercase, line 0.95, tracking `-0.01em`): **"YOUR FENCE PRICE IN 90 SECONDS."** — "90 SECONDS." in brick
  - Lead paragraph (21px Source Sans 3, char, max 58ch): "Drop your address. Draw your line on the satellite. Pick your cedar. Lock the price with a refundable deposit — no sales call, no waiting on a callback."
  - **Address input** (max-width 640px, height 68px, 2px navy/30 border, brick map-pin prefix, "GET MY PRICE" submit button on the right in brick)
    - Focus state: border-2 navy + 5px navy/12 ring
    - Submit button is inset 6px from input edges (`m-1.5`)
  - Below input: small steel text "Quoted in 90 seconds. Scheduled in 24 hours. Installed in two weeks."
- Trust bar (4 columns): Licensed (OK #FP-22-4810), Bonded & Insured, Warranty (15-Year Workmanship), Family-Owned (Tulsa, since 2003) — each with a brick star icon
- Cream-banded reassurance section (3 columns, 56px padding): Cedar That Knows The Sky / Concrete-Set, Post By Post / Fifteen Years. One Handshake. — each with brick `01 · CRAFT` mono eyebrow
- `<Footer />` — navy-deep with brass top accent

**Interactions:**
- Address input shows Google Places autocomplete dropdown (cream/60 mono header "Suggestions · Powered by Google Places", paper rows w/ brass pin + ink address + mono uppercase city/zip)
- On select: dropdown closes, navigate to `/address/confirm`
- "Get My Price" button: navigate to `/address/confirm` (with whatever query the user typed even if no selection)

**Mobile:**
- Header collapses to lockup + phone CTA only
- Hero pads down to ~56px top
- H1 drops to 44px
- Lead drops to 18px
- Submit button stacks below input (full width 56px)
- Trust bar becomes 2-column grid
- Reassurance section becomes 1-column

---

### 2. `/address/confirm` — Satellite + Ownership Gate

**Purpose:** Confirm geocoded house is correct AND collect ownership/consent before any further work.

**Layout (desktop):** Two-column grid `lg:grid-cols-[1.15fr_1fr]`, gap 40px, padding 56px vertical.

**Left column — Satellite preview:**
- Aspect 5:4, cream border, large card shadow
- Mapbox satellite tile of the geocoded house, ~zoom 19
- **Top-left address chip:** navy/95 bg, cream text, brass border, mono uppercase. "LOCATED" label in brass, address below.
- **Top-right N compass:** 36px paper circle, navy "N"
- **Bottom-right scale bar:** paper/90 bg, mono uppercase "30 FT" with navy bar
- Below map: mono caption "● Mapbox Satellite · USDA NAIP Imagery" (brass dot + steel)
- The roof outline is drawn as a navy 2px stroke on the satellite, with a brick pin overlay at the centroid

**Right column:**
- Eyebrow: "Step Two · Confirm Property"
- H2 (44px Oswald 700, uppercase): **"Is This Your House?"**
- Lead paragraph
- **Yes/No segmented buttons** (2-column grid, 56px tall):
  - "Yes, that's it" — selected = navy bg, cream text, navy border
  - "No, wrong house" — selected = paper bg, brick text, brick border
- **Ownership Verification** (gated — opacity-50 + pointer-events-none until confirmed='yes'):
  - Mono brick "REQUIRED" + hairline
  - H4 eyebrow "Ownership Verification"
  - Lead paragraph: "We can only quote, schedule, and build with the homeowner — or someone with their written consent. This protects you, your neighbors, and our crews."
  - 2 radio cards (full width, 4px padding, border navy/20):
    - "I own this property" — sub: "You'll sign during the deposit step."
    - "I have written consent from the owner" — sub: "We'll request a signed authorization before scheduling."
  - Selected card: cream bg, navy border, ring-2 brass/40, filled brick radio dot
- Bottom row: text "← Back" link (steel) + Primary CTA "Continue To Drawing" (disabled until both yes + ownership selected)

**Interactions:**
- Wrong house → modal "Refine your address" → back to `/address` with input pre-filled
- Yes + ownership selected → primary CTA enables → on click route to `/draw`

**Mobile:**
- Single column, satellite stacks below the form (order-1/order-2 inversion)
- Ownership cards stack full width

---

### 3. `/draw` — Map Drawing (The Core Screen)

**Purpose:** User traces their fence line on satellite imagery. Live linear-footage feedback. Gate placement. Most complex screen.

**Layout (desktop):** Two-column grid `lg:grid-cols-[1fr_340px]`, gap 24px, padding 16-24px.

**Left column — Map:**
- Full-height map container `aspect-[5/4] lg:aspect-auto lg:h-[calc(100vh-200px)]`
- 2px brass/40 border, large dark drop shadow
- `cursor-crosshair`
- Mapbox satellite renders here. **The chrome is the design — the map renders inside the container as-is.**

**Map overlay UI (absolutely positioned on map):**

*Top toolbar — left cluster (navy/95, brass/35 border, divide-x brass/20):*
- Fence Line tool button — 44px tall, font-display uppercase 12px, brass-bg when active
- Add Gate tool button — same style

*Top toolbar — right cluster:*
- Undo IconBtn (cream icon, hover bg cream/10)
- Clear All IconBtn (brick icon — destructive variant)
- Help "?" IconBtn

*Bottom-left:* Scale bar (paper/90 chip, mono uppercase "50 FT" + navy bar)
*Bottom-right:* Attribution chip (navy/70 bg, brass/70 text, mono uppercase "© Mapbox · USDA NAIP")

*Self-intersect warning banner* (when fence line crosses itself):
- Centered horizontally, ~bottom: 64px, max-width 420px
- Brick bg, cream text, brick-deep border, lg shadow
- Triangle-warning icon + "LINES CROSSED" eyebrow + "Your fence line intersects itself. Undo the last point or clear and start over."

*Empty-state hint* (when 0 points and modal closed):
- Centered overlay, navy/85 bg, brass/35 border, max-width 340px, padded 16px
- Brass eyebrow "TAP TO START" + cream body "Click each corner of your fence, in order."

*Drawn fence line (SVG layer):*
- Polyline with brass stroke (3px) — switches to brick stroke when self-intersects
- Each corner: navy circle r=9, cream stroke 2.5px, with mono numbered label inside (cream, 9px)
- Gates: brass rectangle 24×28px, navy 2px border, vertical center line (gate-hinge indicator)

**Right column — Side panel (paper, brass/25 border, rounded-md):**
- **Section 1 (top, p-20, border-bottom):**
  - Eyebrow "Step Three · Draw Your Line"
  - H3 "Trace The Fence Run"
  - Helper: "Click each corner on the map. We measure as you go."
- **Section 2 (live readout, 2-col grid):**
  - "LINEAR FEET" mono caption (steel) + huge brick numeral with " LF" suffix in mono — **44px Oswald 700, tabular nums**
  - "GATES" + huge navy numeral
  - Full-width row: "CORNERS" + smaller navy 22px numeral + helper "posts staked"
- **Section 3 (cream/60 bg, tool hint):**
  - "CURRENT TOOL" mono eyebrow (brick)
  - Icon + uppercase tool name (navy 14px)
  - Contextual hint: "Click each corner. Lines can't cross themselves." / "Tap on the fence line where you want a gate."
- **Section 4 (bottom, mt-auto):**
  - **Primary CTA "Continue · Pick Materials"** — full width, h-14
  - Disabled state: when `points.length < 2` OR `selfIntersects = true`
  - Helper text under disabled CTA explaining why
  - Small "← Back" link below

**Welcome / Help Modal** (auto-opens on first visit; persistent "?" button reopens):
- Cream paper bg, navy/15 border, brass 1px top accent, max-width 520px
- 4 steps with small SVG illustration (200×200 viewBox) on cream
  1. **"Tap Each Corner"** — illustration: dashed lot rectangle + navy polyline corners + brick dots
  2. **"Drop A Gate"** — illustration: navy line + brass gate
  3. **"Undo Anytime"** — illustration: polyline + brick endpoint + brass undo glyph
  4. **"Lines Can't Cross"** — illustration: self-crossing brick polyline + brick dashed circle at intersection
- Each step: brass-dashes eyebrow + Oswald 28px h3 + body paragraph
- Footer: page-dot indicator (brick=current, steel-soft=todo) + Back / Next / "Start Drawing" CTA

**State (recreate in real codebase):**
```ts
type FenceState = {
  points: Array<{ x: number; y: number; lng: number; lat: number }>;
  gates:  Array<{ x: number; y: number; lng: number; lat: number; segmentIndex: number }>;
};
```

**Live linear-foot calculation:** sum of `haversine` distance between consecutive points (the prototype uses Pythagorean px × scale; real app uses lng/lat haversine in feet).

**Self-intersection check:** classic segment-intersect (proper, excluding shared endpoints). See `segIntersect()` in `source/screens-b.jsx`. Run on every point add.

**Interactions:**
- Map click adds point or gate based on selected tool
- Tool toggle switches between fence/gate
- Undo removes the last item of the active tool
- Clear nukes everything (consider a confirm dialog in production)
- Welcome modal opens once per session — track via session cookie

**Mobile:**
- Stack: map on top (aspect-5/4), panel below
- Toolbar buttons collapse to icon-only on narrow widths
- Help modal full-bleed on small screens

---

### 4. `/configure` — Materials, Tier, Height, Add-ons

**Purpose:** Translate the drawn fence into a real product spec.

**Layout (desktop):** Two-column `lg:grid-cols-[1fr_360px]`, gap 32px, padding 56px vertical.

**Header row:**
- Eyebrow "Step Four · Pick Materials" + H2 "Build Your Fence"
- Helper line: "142 linear feet · 1 gate. Pick a family, a tier, and a height — we'll price it as you go."
- Mono right-aligned: `QUOTE-IN-PROGRESS · FP-2026-04812`

**Left column — Selectors (stacked vertically, gap-40):**

Each section has a section header: brick mono "01" + Oswald uppercase label + hairline divider.

**01 — Fence Family** (3-column grid):
- 5 fence types: Cedar Privacy, Horizontal Cedar, Ornamental Metal, Chain Link, Ranch Rail
- Each card: ~200px tall, paper bg, p-5, navy/15 border
- Top: 80×60px monochrome SVG line-sketch of fence style (uses `currentColor`; navy when active, navy/60 when inactive)
- Eyebrow uppercase name
- 2-line description in steel 12.5px
- Bottom row: mono "FROM" + brick price "$38" + mono "/LF"
- **Active state:** cream bg, 1px navy border, ring-2 brass/40, card shadow, small brass-coin checkmark badge top-right

**02 — Tier** (3-column grid):
- Standard / Premium / Estate, each as a card
- Uppercase Oswald name + brass pickets motif (1 / 2 / 3 pickets corresponding to tier)
- 1-line description (steel)
- Bottom: brick mono "Base price" / "25% upgrade" / "55% upgrade"
- **Active:** navy bg, cream text — brass text where appropriate

**03 — Height** (segmented inline-flex):
- 4 ft / 6 ft / 8 ft in a cream pill, navy/15 border, p-1
- Active: navy bg, cream text

**04 — Add-Ons** (3-column grid of toggle cards):
- Gates Hung — "$N placed · welded hinges, drop rod" — "+ $380 ea"
- Tear-Out & Haul — "+ $4.50/lf"
- Cedar Sealer — "+ $6/lf"
- Each card: toggle switch top-right (brick when active, steel-soft when off), brand-style 36×20 oval

**Right column — Running estimate (sticky on desktop):**
- Navy card with brass/30 border
- Top section: brass mono "RUNNING ESTIMATE" + huge cream Oswald 700 40px tabular numeral
- "Final range shown on the next step." helper
- Line items (each row: cream/80 label + mono cream value):
  - "Cedar Privacy · Premium · 6 ft" $5,400
  - "1 gate" $380
  - "Tear-out & haul" $639
- Primary CTA "See Final Price" (full width, h-14)
- "← Back To Map" link below
- Beneath the card: small cream/60 card "What This Covers" with brick mono caption + tight body

**Pricing math:**
```
base   = familyPerLF × tierMultiplier × heightMultiplier × linearFeet
gates  = (gates ? 1 : 0) × gateCount × $380
demo   = demo  ? linearFeet × $4.50 : 0
stain  = stain ? linearFeet × $6.00 : 0
total  = base + gates + demo + stain
```
Where:
- familyPerLF: cedar=38, horizontal=62, ornamental=55, chain=18, ranch=24
- tierMultiplier: standard=1.0, premium=1.25, estate=1.55
- heightMultiplier: 4ft=0.85, 6ft=1.0, 8ft=1.25

**Fence-style SVG sketches:** see `source/screens-c.jsx` — `FENCE_SKETCHES` object exports 5 monochrome 80×60 SVG groups. Use `currentColor` so they color-shift on selection.

**Mobile:**
- Right column unsticks and moves to the top as a compact summary card or stays at bottom — design decision; recommend bottom-sticky bar with just price + CTA, expand on tap

---

### 5. `/quote` — Final Price + Deposit

**Purpose:** Show the locked-in price range and convert to deposit.

**Layout (desktop):** Two-column `lg:grid-cols-[1.1fr_1fr]`, gap 48px, items-start.

**Spec line (top of page, before columns):**
- Mono uppercase brick: `QUOTE #FP-2026-04812 · 142 LF · CEDAR PRIVACY · 6 FT · PREMIUM`

**Left column — Price + Deposit:**
- Eyebrow "Step Five · Locked In Range"
- H2 "Your Price. Plain And Held." (two lines)
- **Price card:** cream bg, navy/15 border, brass 1px top accent, p-7
  - Mono "YOUR RANGE" (steel)
  - **Huge brick numerals**: `$5,400 – $6,200` — 84px Oswald 700, tabular nums, brick. The em-dash is brick/40.
  - The MAX is the calculated total. The MIN is 88% of max (range presented downward).
  - Helper paragraph: "Final price falls inside this range after a quick site verification — and **it won't exceed the maximum**. If we measure shorter, you pay less."
- **Primary CTA**: "Lock It In · $99 Refundable Deposit" — `size="xl"` (h-16, px-10), brick bg
- Reassurance below CTA (steel 13px): "Refundable within 24 hours. Applied to your final total. Cards processed by Stripe — we never see the number."
- **Schedule preview** (3-column grid of cream cards): Quoted Today / Scheduled Within 24 hrs / Installed In two weeks — each with brick mono "01/02/03" + navy eyebrow + larger navy uppercase value

**Right column — What's Included + Reviews:**
- **Navy trust card** (brass/30 border):
  - Header row: brass mono "TRUST BLOCK" + cream uppercase "WHAT'S INCLUDED" + Star Coin 44px on the right
  - 5-row list, each row: brass coin checkmark + cream eyebrow + cream/80 body
    1. **Permits, Handled** — "We pull every permit, call OK811 for line locates, and coordinate HOA approval where needed."
    2. **Western Red Cedar, Graded** — "Kiln-dried, premium-grade boards. No knots, no warps, no surprises at delivery."
    3. **Concrete-Set Posts, Plumb** — "30-inch footings, bedded in 3,000-psi concrete. Checked twice with a 4-foot level."
    4. **Cleanup, Top To Bottom** — "Old fence hauled, magnets run for nails, jobsite swept. We leave the yard better than we found it."
    5. **Fifteen-Year Workmanship** — "If a panel fails on our build, we fix it. One handshake. No second opinions."
  - Footer band (navy-deep): brass tagline `— BUILT RIGHT · STANDS STRONG —` + small pickets motif
- **Review snippet card** (cream-deep): 5 brass stars + mono "Google · 342 reviews" + italic review quote + Oswald uppercase attribution

**Loading state:** While price is calculating, swap the price card body with a centered **Star Coin** (56px, `.coinpulse` animation) above mono caption "PLUMB, SQUARE, PRICED…". Don't show a skeleton — show the brand mark.

**Error states:**
- Address not found: brick toast "We couldn't pin that address." with a "Try again" button
- Payment failure: cream modal, brick mono "PAYMENT — NOT POSTED" eyebrow, body "Your card wasn't charged. Try a different method or call 918 555 0144." + retry button

**Mobile:**
- Stack: price card first (full width), CTA below, then trust card, then reviews
- Price drops to 64px

---

## Shared Components

### `<Header />` props
```ts
type HeaderProps = { dark?: boolean; onHome?: () => void; phone?: string };
```
- `dark` switches to navy bg + brass-bordered (used on `/draw`)
- Light mode is paper bg, navy/10 border-bottom

### `<Progress />` props
```ts
type ProgressProps = { step: 0|1|2|3|4; dark?: boolean; onJump?: (i:number)=>void };
```
- Step states: done (brass), current (navy or cream — bg-fill, ring-2 brass), todo (border-only steel-soft)
- Connector bars: brass for done, navy/cream for current, steel-soft/55 for todo
- Mobile: hides text labels, shows numbered chips only

### `<PrimaryButton />` (cream-on-brick)
Sizes: `sm` (h-10) / `md` (h-12) / `lg` (h-14) / `xl` (h-16)
- bg-brick, text-cream, font-display uppercase font-semibold tracking-eyebrow
- hover: bg-brick-deep
- disabled: bg-steel-soft text-cream cursor-not-allowed
- Shadow: `shadow-cta` (subtle red-tinted drop)

### `<SecondaryButton />` (navy outline)
- bg-transparent, text-navy, border navy/30
- hover: border-navy bg-navy/4
- `dark` variant: cream text + cream/40 border on dark backgrounds

### `<TextInput />`
- h-14, paper bg, navy/25 border, rounded-sm
- Focus: border-navy, ring-3 navy/15
- Source Sans 3 17px, steel/70 placeholder
- Error state: brick border + brick helper text below

### `<Eyebrow>` — brass dashes flourish
Renders: `[short dash][long dash] TEXT [long dash][short dash]`. Use as section label / "step X · …" intro.

### `<Modal />`
- Centered, paper bg, navy/15 border, brass 1px top accent, navy-deep/60 backdrop-blur backdrop
- Closes on backdrop click

### `<StarCoin />` — brand loading + favicon
- Navy disc, brick inner roundel, brass ring, cream 5-point star
- `pulse` prop adds `coinpulse` 1.6s ease-in-out infinite animation

### `<TrustBar />`
4-column grid with brick (or brass on dark) 5-point star + Oswald eyebrow label + body sub.

### `<Footer />`
- bg-navy-deep, brass 3px top accent
- 4-column grid: lockup + tagline / Service / Company / Contact
- Bottom band: brass mono "FENCEPROS · TULSA · OKLAHOMA · EST. 2003" + pickets motif + mono OK Contractor #

---

## Interactions & Behavior

**Page transitions:** Subtle fade (150ms ease) on route change. No flashy slides — premium = restrained.

**Hover states:**
- Buttons: `transition-colors duration-150`
- Cards: border darkens (navy/15 → navy/40), no scale or translate
- Links: underline on hover (steel → navy)

**Focus states:** Always visible ring — navy/15 ring 3px on inputs, brass ring on selected cards.

**Loading states:**
- Map loading: cream/90 overlay with centered Star Coin (pulse) + "LOADING SATELLITE…" mono caption
- Price calculating: replace numerals with pulsing Star Coin
- Address geocoding: spinner in input suffix area

**Error states (brick on cream):**
- Address not found: small brick chip above input "Couldn't pin that address — try a cross-street or postal code"
- Self-intersect: full warning banner on map (see /draw)
- Payment fail: modal with brick mono eyebrow + retry CTA

**Form validation:**
- Address: 3+ chars to fire autocomplete
- Ownership: required to enable Continue
- Card: handled by Stripe Elements — restyle to brand (cream-deep bg, navy focus border)

**Responsive breakpoints:**
- Mobile-first. Tailwind `md:` = 768px, `lg:` = 1024px.
- All 5 screens have explicit mobile layouts — see each screen section.
- Map drawing **must** work with touch on mobile (tap to add point).

---

## State Management

The funnel state needs to be **shared across all 5 routes**. Recommend `React Context` provider wrapping the funnel route group, OR Next.js searchParams + a Zustand store. Production already uses session cookies — preserve that.

```ts
// Suggested shape
type FunnelState = {
  // /address
  address: { formatted: string; placeId: string; lat: number; lng: number } | null;
  // /confirm
  confirmed: boolean;
  ownership: 'owner' | 'consent' | null;
  // /draw
  fenceLine: { points: GeoPoint[]; gates: GateLocation[] };
  // /configure
  config: {
    family: 'cedar' | 'horizontal' | 'ornamental' | 'chain' | 'ranch';
    tier: 'standard' | 'premium' | 'estate';
    height: '4 ft' | '6 ft' | '8 ft';
    addons: { gates: boolean; demo: boolean; stain: boolean };
  };
  // /quote
  quote: { min: number; max: number; quoteId: string };
};
```

**Required state transitions:**
- Each screen advances on Primary CTA click → route push to next screen
- Back link → router.back()
- Progress bar step chips → router.push(`/${routeName}`) — but **prevent forward jumps** that skip required gates (e.g. can't jump to /quote before confirming ownership)

---

## Files in This Bundle

```
design_handoff_quoteos_funnel/
├── README.md                  ← you are here
├── source/
│   ├── index.html             ← shell (Tailwind CDN + font preload + base CSS)
│   ├── app.jsx                ← state machine, screen router, tweaks panel
│   ├── components.jsx         ← Header, Progress, PrimaryButton, SecondaryButton,
│   │                            TextInput, Eyebrow, StarCoin, Badge, Modal,
│   │                            TrustBar, Footer, IconBtn
│   ├── screens-a.jsx          ← AddressScreen, ConfirmScreen
│   ├── screens-b.jsx          ← DrawScreen (+ segIntersect helper)
│   ├── screens-c.jsx          ← ConfigureScreen, QuoteScreen, FENCE_SKETCHES
│   ├── tweaks-panel.jsx       ← prototype tweaks UI (do not port to production)
│   └── FencePros Brand Guidelines.html  ← original brand spec — keep open while implementing
└── tokens/
    ├── tailwind.config.ts     ← drop-in production Tailwind config
    └── brand.css              ← brass-dash & picket utility classes + fonts import
```

**How to run the prototype locally:** open `source/index.html` in any modern browser. No build step. Tailwind via CDN.

---

## Assets

**Required real assets (provide to dev):**
- **FencePros badge** — full heraldic shield, transparent PNG @2x AND SVG. The prototype uses an SVG placeholder in `components.jsx::Badge` — **replace this**.
- **Real fence photography** — for `/quote` aside or hero alternate layouts. The prototype doesn't use photo placeholders, but the brand system supports them with brass top-accents over photos.

**Icons used:** Inline SVG, stroke 2-2.5, currentColor — based on Lucide. Recommend installing `lucide-react` and replacing the inline paths with `<Phone />`, `<MapPin />`, `<Undo2 />`, `<Trash2 />`, `<AlertTriangle />`, etc. for consistency.

**Fonts:** Google Fonts — Oswald, Source Sans 3, JetBrains Mono. Use `next/font/google` in `app/layout.tsx`:
```ts
import { Oswald, Source_Sans_3, JetBrains_Mono } from 'next/font/google';
const oswald = Oswald({ subsets:['latin'], weight:['400','500','600','700'], variable:'--font-display' });
const source = Source_Sans_3({ subsets:['latin'], weight:['300','400','600','700'], variable:'--font-body' });
const jet    = JetBrains_Mono({ subsets:['latin'], weight:['400','500'], variable:'--font-mono' });
```

---

## Implementation Notes

1. **Replace placeholder brand tokens.** The existing app uses `#1F3A5F` navy + `#F4A623` gold. Replace globally with `#1A2A4A` navy + `#C8962E` brass.
2. **Map chrome only.** Don't redesign Mapbox integration. Position toolbar, counter, instructions modal, and warning banner **around/over** the existing `<MapContainer>`. The map renders behind the chrome.
3. **No localStorage / sessionStorage** — confirmed unsupported. Use React state and session cookies.
4. **Use `next/font`** for the three Google Fonts to avoid layout shift.
5. **Keep one Display headline per screen.** If you find yourself adding a second `text-d-h2`, demote it to `text-d-h3`.
6. **Brick is a stamp, brass is a finish.** Never fill a large block with either — they exist to terminate, accent, or call out, not to occupy.
7. **Test the self-intersect detection on touch.** The proper segment-intersect algorithm is in `source/screens-b.jsx::segIntersect`.
8. **Skip the Tweaks panel.** `tweaks-panel.jsx` is a prototype-only tool for the design review — don't port it.

---

## Approved Microcopy Library

For consistency, here's the exact copy used in the prototype — feel free to reuse verbatim or extend with the voice rules.

**`/address`:**
- Eyebrow: "Built Right · Stands Strong"
- H1: "Your Fence Price In 90 Seconds."
- Lead: "Drop your address. Draw your line on the satellite. Pick your cedar. Lock the price with a refundable deposit — no sales call, no waiting on a callback."
- Subline: "Quoted in 90 seconds. Scheduled in 24 hours. Installed in two weeks."
- CTA: "Get My Price"

**`/address/confirm`:**
- Eyebrow: "Step Two · Confirm Property"
- H2: "Is This Your House?"
- Lead: "We pulled this from the address you entered. Confirm the rooftop, then verify you have the right to put a fence on this property."
- Yes button: "Yes, that's it" / No: "No, wrong house"
- Ownership H4: "Ownership Verification"
- Ownership lead: "We can only quote, schedule, and build with the homeowner — or someone with their written consent. This protects you, your neighbors, and our crews."
- Options: "I own this property" / "I have written consent from the owner"
- CTA: "Continue To Drawing"

**`/draw`:**
- Eyebrow: "Step Three · Draw Your Line"
- H3: "Trace The Fence Run"
- Helper: "Click each corner on the map. We measure as you go."
- Empty hint: "Tap To Start — Click each corner of your fence, in order."
- Help steps:
  1. "Tap Each Corner — Click or tap each corner of your fence line, in order. We turn it into linear feet automatically."
  2. "Drop A Gate — Switch to the gate tool to place a gate anywhere on the fence line. Add as many as you need."
  3. "Undo Anytime — Tap Undo to remove the last point. Tap Clear to start over. We won't save until you continue."
  4. "Lines Can't Cross — Fences don't intersect themselves. If your line crosses, we'll flag the spot so you can fix it before continuing."
- Self-intersect warning: "Lines Crossed — Your fence line intersects itself. Undo the last point or clear and start over."
- CTA: "Continue · Pick Materials"

**`/configure`:**
- Eyebrow: "Step Four · Pick Materials"
- H2: "Build Your Fence"
- Section labels: "Fence Family / Tier / Height / Add-Ons"
- Add-on names: "Gates Hung" / "Tear-Out & Haul" / "Cedar Sealer"
- Estimate caption: "Running Estimate"
- "Final range shown on the next step."
- CTA: "See Final Price"
- Coverage note: "Materials, labor, concrete, fasteners, cleanup, and our 15-year workmanship warranty. Permits handled by us."

**`/quote`:**
- Spec line: `QUOTE #FP-2026-04812 · 142 LF · CEDAR PRIVACY · 6 FT · PREMIUM`
- Eyebrow: "Step Five · Locked In Range"
- H2: "Your Price. Plain And Held."
- Range caption: "Your Range"
- Range helper: "Final price falls inside this range after a quick site verification — and **it won't exceed the maximum**. If we measure shorter, you pay less."
- CTA: "Lock It In · $99 Refundable Deposit"
- Reassurance: "Refundable within 24 hours. Applied to your final total. Cards processed by Stripe — we never see the number."
- Schedule cards: "Quoted Today / Scheduled Within 24 hrs / Installed In two weeks"
- Trust block H3: "What's Included"
- Trust items:
  1. "Permits, Handled — We pull every permit, call OK811 for line locates, and coordinate HOA approval where needed."
  2. "Western Red Cedar, Graded — Kiln-dried, premium-grade boards. No knots, no warps, no surprises at delivery."
  3. "Concrete-Set Posts, Plumb — 30-inch footings, bedded in 3,000-psi concrete. Checked twice with a 4-foot level."
  4. "Cleanup, Top To Bottom — Old fence hauled, magnets run for nails, jobsite swept. We leave the yard better than we found it."
  5. "Fifteen-Year Workmanship — If a panel fails on our build, we fix it. One handshake. No second opinions."
- Footer tagline: "— Built Right · Stands Strong —"

---

## Questions or Clarifications

Open `source/index.html` and inspect the prototype directly while building — every value (spacing, color, shadow, transition timing) is in the source. The brand guidelines (`source/FencePros Brand Guidelines.html`) should remain the source of truth if any conflict arises between this README and the brand spec.
