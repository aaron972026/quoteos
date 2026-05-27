# QuoteOS — Production Deploy Runbook

**Target:** Take QuoteOS from local-only (`C:\Users\Aaron\quoteos`) to live on `https://fenceprostulsa.com`.
**Stack:** Next.js 14.2 → Vercel · Supabase Postgres · Stripe · Resend · Mapbox · Google Places.
**Estimated time:** 3–5 focused hours, most of it waiting on DNS propagation.

> **How to use this:** Work top to bottom. Do NOT skip ahead — several steps depend on URLs or secrets produced by earlier steps. Each phase ends with a verification. If a verification fails, fix it before moving on. The 🔴 callouts are the things that break **silently** in production if missed — they cause no error in the build, just a dead map or a failed webhook nobody notices until a customer hits it.

---

## Decision Points (settle these before you start)

**1. Stripe: test mode or live mode for launch?**
- **Recommended for first launch: LIVE mode with a real $99 deposit.** A live deposit is the whole point — a test-mode launch can't take money. You're confident in the funnel; go live.
- If you want one more dry run first, deploy in test mode, run yourself through it with a Stripe test card, then swap to live keys (Phase 5) and redeploy. The swap is 3 env vars + one webhook re-register.

**2. Supabase: reuse the dev project, or spin a clean prod project?**
- **Recommended: reuse the existing project.** Migrations are already applied and seeded there. For a solo launch, dev/prod sharing one project is pragmatic and fine. Just be disciplined about not running destructive scripts against it once real quotes exist.
- Spin a clean prod project only if you want hard dev/prod isolation. Costs you re-running the migration + seed (Phase 2) against the new project and a second set of keys. Defer this until you actually have a reason.

**3. The $100 gate discrepancy + slope-3 change.**
- Your `check-pricing.ts` flags a $100 gap (engine $7,500 vs CSV $7,600) from the walk-gate cost ($350 in `data.ts` vs $450 in the model), and slope-3 dropped 22%→18%.
- **Decision: settle the gate number before launch.** Pick the real walk-gate cost, align `data.ts` and the spreadsheet, re-run tests. A $100 disagreement between your canonical model and live engine compounds silently across every quote. The slope-3 change just needs a one-line confirmation it was intentional. This is a 20-minute fix and it's cheaper now than after you've quoted 50 customers.

---

## Phase 0 — Pre-flight (local, before touching anything external)

- [ ] **Confirm clean working tree mentally** — know what's uncommitted (~handoff says repo is local-only, so everything).
- [ ] **Reconcile the gate price** (Decision 3) in `lib/pricing/data.ts`, re-run pricing tests.
- [ ] **Run the full verification ladder — all three must be green:**
  ```bash
  npx.cmd tsc --noEmit          # expect: clean
  npm.cmd run lint              # expect: clean
  npm.cmd run test:run          # expect: 117 passing
  ```
- [ ] **Production build locally** — catches build-only errors before Vercel does:
  ```bash
  npm.cmd run build             # expect: compiled successfully
  ```
  If this fails, Vercel will fail too. Fix here where iteration is faster.
- [ ] **Inventory your `.env.local`** — open it and confirm you have a real value (not a placeholder) for every var you intend to use in production. The app returns 503 for `.env.example`-style placeholders (`sk_test_xxx`, `re_xxx`), so a forgotten var fails loudly at the route — good, but better to catch now.

🔴 **`.gitignore` check — DO THIS BEFORE THE FIRST COMMIT.** Confirm `.env.local` (and `.env*.local`) is gitignored. If you commit secrets to GitHub even once, they're in history forever and must all be rotated.
```bash
cat .gitignore | grep -E "\.env"     # must list .env*.local or .env.local
git check-ignore .env.local          # must print: .env.local  (proves it's ignored)
```
If `git check-ignore` prints nothing, STOP and add `.env*.local` to `.gitignore` before continuing.

---

## Phase 1 — Source Control (GitHub)

- [ ] **Initialize and make the first commit:**
  ```bash
  cd C:/Users/Aaron/quoteos
  git init
  git add .
  git status                    # eyeball the list — confirm NO .env.local, NO .env*.local
  git commit -m "Initial commit: QuoteOS Phase 1 + Brand v1.0 + Pricing v2"
  ```
- [ ] **Create the GitHub repo** (private): github.com → New repository → name `quoteos` → Private → do NOT initialize with README (you already have files).
- [ ] **Add remote and push:**
  ```bash
  git remote add origin https://github.com/<your-username>/quoteos.git
  git branch -M main
  git push -u origin main
  ```
- [ ] **Verify on GitHub** the repo is private and `.env.local` is NOT in the file list.

**Verification:** Repo is on GitHub, private, secrets absent.

---

## Phase 2 — Production Database (Supabase)

*(Reusing the existing project per Decision 2. If spinning a new prod project, create it first, then run these against the new `DATABASE_URL`.)*

- [ ] **Confirm the v2 migration is applied** — the handoff says it's already in prod-dev (`labor_cost_per_lf_cents`, `market_max_per_lf_cents`, `market_flag`, `posts_standard` on `skus`; `tier`/`sub_labor_pct` nullable). Verify in Supabase SQL Editor:
  ```sql
  select column_name from information_schema.columns
  where table_name = 'skus'
  order by ordinal_position;
  ```
  Confirm the four v2 columns exist. If not, run the migration:
  ```bash
  npm.cmd run db:push -- --force
  # if drizzle-kit chokes on the CHECK constraint (known issue):
  npx.cmd dotenv -e .env.local -- tsx scripts/migrate-skus-v2.ts
  ```
- [ ] **Seed the catalog** (idempotent — safe to re-run; deletes obsolete SKU codes):
  ```bash
  npm.cmd run db:seed
  ```
- [ ] **Verify SKUs seeded** — expect 9 SKUs across 5 families:
  ```sql
  select code, family, tier from skus order by family, tier;
  ```
- [ ] 🔴 **Create the Storage bucket for photos.** Supabase Dashboard → Storage → New bucket → name exactly `quote-photos` → mark **Public**. Photo upload + AI audit 404 without this.
- [ ] **Confirm `NEXT_PUBLIC_SUPABASE_URL` is the project ROOT** (`https://<ref>.supabase.co`), NOT `.../rest/v1`. The `/rest/v1` suffix breaks Storage uploads. (Handoff notes the storage helper strips it defensively, but set it correctly anyway.)

**Verification:** Schema current, 9 SKUs seeded, `quote-photos` bucket public.

---

## Phase 3 — Vercel Project + Environment Variables

- [ ] **Import the repo:** vercel.com → Add New → Project → import `quoteos` from GitHub. Framework preset auto-detects **Next.js**. Leave build/output settings default.
- [ ] **DO NOT deploy yet** — set env vars first. (See the baked-at-build warning below.)

🔴 **`NEXT_PUBLIC_*` vars are baked into the bundle at BUILD time, not read at runtime.** If you deploy first and add them after, the public vars (Mapbox token, Google Places key, Stripe publishable, Supabase URL, site URL, Wisetack URL) will be `undefined` in the browser until you trigger a fresh build. Set ALL env vars BEFORE the first deploy, or you'll deploy a broken bundle and have to redeploy.

🔴 **Values containing `#` must be wrapped in quotes** when you paste them, or everything after the `#` is treated as a comment and silently truncated. Your Wisetack pre-qual URL is hash-routed — quote it: `"https://...#/prequal"`. Vercel's env UI is usually fine with raw values, but if you use the "paste .env" bulk import, the `#` trap applies.

- [ ] **Set every production env var** (Vercel → Project → Settings → Environment Variables → Production). Copy values from `.env.local`:

  **Core / data:**
  - [ ] `DATABASE_URL` (Supabase pooler URL)
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` (project root — no `/rest/v1`)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SESSION_SECRET`

  **Maps / geo (public — baked at build):**
  - [ ] `NEXT_PUBLIC_MAPBOX_TOKEN`
  - [ ] `NEXT_PUBLIC_GOOGLE_PLACES_KEY`
  - [ ] `REGRID_API_KEY`

  **Payments:**
  - [ ] `STRIPE_SECRET_KEY` (live `sk_live_...` or test `sk_test_...` per Decision 1)
  - [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (matching live/test)
  - [ ] `STRIPE_WEBHOOK_SECRET` — **placeholder for now**; you get the real `whsec_...` in Phase 5 after registering the prod endpoint. Set a dummy now, update in Phase 5.

  **Email / SMS / AI:**
  - [ ] `RESEND_API_KEY`
  - [ ] `RESEND_FROM_EMAIL` — keep `onboarding@resend.dev` for now; switch to `quotes@fenceprostulsa.com` after Phase 6 DNS verification
  - [ ] `ANTHROPIC_API_KEY` (one-time-show — if you lost it, mint a new one)
  - [ ] Twilio vars if SMS recovery is active (`TWILIO_*`)

  **CRM / integrations:**
  - [ ] `GHL_API_KEY`, `GHL_INBOUND_WEBHOOK_URL`, `GHL_LOCATION_ID`
  - [ ] `MAKE_HCP_WEBHOOK_URL`

  **Financing / cron / admin / site:**
  - [ ] `NEXT_PUBLIC_WISETACK_PREQUAL_URL` (quote it if it has `#`)
  - [ ] `CRON_SECRET` (generate a random string — used to authenticate Vercel cron hits)
  - [ ] `ADMIN_PASSWORD_HASH`, `ADMIN_IP_ALLOWLIST` (add your home/office IP)
  - [ ] `NEXT_PUBLIC_SITE_URL` — set to `https://fenceprostulsa.com` now even though DNS isn't pointed yet. (Stripe + magic-link return URLs read this. If you launch on the Vercel preview URL first, set it to that, then change to the custom domain in Phase 8 and redeploy.)

- [ ] **Trigger the first deploy** (Vercel does this automatically after env vars are saved, or hit Deploy). Wait for the build to finish.
- [ ] **Note your Vercel URL** — e.g. `quoteos-xxxx.vercel.app`. You'll test against this before pointing the custom domain.

**Verification:** Build succeeds, Vercel preview URL loads the landing page.

---

## Phase 4 — Third-Party Allowlists (the silent-breakage phase)

🔴 **These break the map and address autocomplete with NO error message if skipped.** The build is green, the page loads, and then the satellite map is blank and the address box does nothing. Do not skip.

- [ ] **Google Places — add production domains to the HTTP referrer allowlist.** Google Cloud Console → APIs & Services → Credentials → your Places API key → Application restrictions → HTTP referrers. Add:
  ```
  https://fenceprostulsa.com/*
  https://*.fenceprostulsa.com/*
  https://quoteos-*.vercel.app/*      ← your Vercel preview pattern
  ```
  Keep `http://localhost:3000/*` for local dev. (Handoff note: dev expects port 3000 specifically because of this allowlist.)

- [ ] **Mapbox — add production URLs to the token's URL restrictions.** Mapbox account → Tokens → your `NEXT_PUBLIC_MAPBOX_TOKEN` → URL restrictions. Add `fenceprostulsa.com`, `*.fenceprostulsa.com`, and your `*.vercel.app` preview domain. (If your token currently has NO URL restrictions, it'll work everywhere — but then anyone can use your token and run up your bill. Restrict it.)

- [ ] **Confirm propagation** — Google/Mapbox allowlist changes take a few minutes. Wait 5, then test in Phase 9.

**Verification:** Deferred to Phase 9 smoke test (the map either renders or it doesn't).

---

## Phase 5 — Stripe (webhook + live mode)

- [ ] **If going LIVE (Decision 1):** toggle to live mode in the Stripe Dashboard, grab `sk_live_...` and `pk_live_...`, update `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel.
- [ ] **Register the production webhook endpoint.** Stripe Dashboard → Developers → Webhooks → Add endpoint:
  - URL: `https://fenceprostulsa.com/api/webhooks/stripe` (or the Vercel URL if launching there first)
  - Events: at minimum `checkout.session.completed` (the deposit confirmation handler). Add `payment_intent.payment_failed` if you want failure handling.
- [ ] **Copy the signing secret** (`whsec_...`) Stripe generates for that endpoint.
- [ ] **Update `STRIPE_WEBHOOK_SECRET` in Vercel** with the real `whsec_...` (replacing the Phase 3 placeholder).
- [ ] 🔴 **Redeploy** so the new webhook secret is live. (A wrong/placeholder webhook secret means deposits succeed in Stripe but your app never gets the confirmation — the quote never flips to "deposit paid," no GHL lead, no HCP job. Silent and bad.)

**Verification:** Deferred to Phase 9 (test deposit must flip the quote state).

---

## Phase 6 — Email Domain (Resend + Cloudflare DNS)

*(Can run in parallel with everything; DNS takes time.)*

- [ ] **Add domain in Resend** → Domains → Add `fenceprostulsa.com`. Resend gives you DNS records (SPF/TXT, DKIM, and a return-path/MX record).
- [ ] **Add those records in Cloudflare DNS** (your registrar). For each Resend record, create the matching DNS entry. 🔴 **Set DKIM/SPF records to "DNS only" (grey cloud), not "Proxied" (orange cloud)** — Cloudflare's proxy breaks email auth records.
- [ ] **Click Verify in Resend.** Propagation is usually minutes, sometimes up to 24h.
- [ ] **Once verified, update `RESEND_FROM_EMAIL`** in Vercel to `quotes@fenceprostulsa.com` (or your chosen sender) and redeploy. Until verified, leave it on `onboarding@resend.dev` so email still works.

**Verification:** Resend shows the domain "Verified"; a test "email this quote" lands in an inbox (Phase 9).

---

## Phase 7 — Cron Jobs (Vercel)

- [ ] **Confirm `vercel.json` declares the crons.** Should include the abandoned-cart job and the material-index job:
  ```json
  {
    "crons": [
      { "path": "/api/cron/abandoned-cart", "schedule": "*/15 * * * *" },
      { "path": "/api/cron/material-index", "schedule": "0 9 * * *" }
    ]
  }
  ```
  (Adjust schedules to taste — abandoned-cart every 15 min, material-index daily is reasonable.)
- [ ] 🔴 **Confirm the cron routes check `CRON_SECRET`.** Vercel cron requests include an `Authorization: Bearer <CRON_SECRET>` header. Your route handlers should reject requests that don't match, or anyone can hammer your cron endpoints. If not implemented, add it before launch or the endpoints are public.
- [ ] **After deploy, verify in Vercel** → Project → Cron Jobs that both are registered and showing next-run times.

**Verification:** Both crons appear in the Vercel Cron Jobs tab with scheduled next runs.

---

## Phase 8 — Custom Domain (Cloudflare → Vercel)

- [ ] **Add the domain in Vercel** → Project → Settings → Domains → add `fenceprostulsa.com` and `www.fenceprostulsa.com`.
- [ ] **Point DNS in Cloudflare.** Vercel will tell you exactly what to add — typically:
  - An `A` record for the apex (`fenceprostulsa.com`) pointing to Vercel's IP, or a `CNAME` if using `www`, OR
  - The cleanest: follow Vercel's instructions exactly. For Cloudflare apex, you may use a CNAME flattened record.
- [ ] 🔴 **Set the Vercel-pointing DNS records to "DNS only" (grey cloud) initially**, not proxied. Cloudflare's proxy in front of Vercel can cause SSL/redirect loops. Get it working grey-cloud first; only proxy later if you have a specific reason and know how to configure it.
- [ ] **Wait for SSL** — Vercel auto-provisions a Let's Encrypt cert once DNS resolves. Domain shows "Valid Configuration" when ready.
- [ ] **Set the apex/www redirect** — decide whether `www` redirects to apex or vice versa (Vercel handles this in the Domains UI). Pick one canonical.
- [ ] **Update `NEXT_PUBLIC_SITE_URL`** to `https://fenceprostulsa.com` if it wasn't already, and **redeploy** so Stripe/magic-link return URLs use the real domain.
- [ ] **Update the Stripe webhook URL** (Phase 5) to the custom domain if you registered it against the Vercel URL earlier. Re-copy the `whsec_` if Stripe issues a new one, update Vercel, redeploy.

**Verification:** `https://fenceprostulsa.com` loads with a valid padlock (SSL), no cert warnings.

---

## Phase 9 — Full Funnel Smoke Test (the real verification)

Walk the entire funnel on the **production domain** (or Vercel URL if launching there). This is where you catch the silent failures from Phases 4–6.

- [ ] **Landing page** (`/`) — loads, brand renders, fonts correct (Oswald/Source Sans), Insurance Claim band present, storm line number correct.
- [ ] **Address** (`/address`) — 🔴 type an address; Google autocomplete suggestions appear. If the box does nothing → Google Places referrer allowlist (Phase 4). Pick a suggestion; the "Located ·" chip shows.
- [ ] **Confirm** (`/address/confirm`) — satellite image loads; ownership gate appears and gates progression correctly (test the "not the owner" path too).
- [ ] **Draw** (`/draw`) — 🔴 satellite map renders. If blank → Mapbox URL restriction (Phase 4). Onboarding modal shows on first visit. Draw a line; linear-footage counter updates. Place a gate. Trigger self-intersection and confirm the warning + disabled Continue.
- [ ] **Configure** (`/configure`) — 5 family cards with sketches; GOOD/BETTER/BEST tiers; toggles (stain, steel posts, cap rail, vinyl posts) adjust the sticky estimate live.
- [ ] **Quote** (`/quote/[id]`) — price range displays correctly; invoice shows permits/811 as "incl."; Wisetack widget loads; family-aware trust card shows the right material line; margin/guard internals are NOT visible.
- [ ] **Email this quote** — send it to yourself. 🔴 If it doesn't arrive → Resend domain/DNS (Phase 6) or check the Resend dashboard logs (remember: Resend returns `{error}` without throwing, so check logs not just for an error popup).
- [ ] **Deposit (the critical path):**
  - LIVE mode: run a real $99 deposit on a real card (you can refund yourself after).
  - TEST mode: use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
  - [ ] 🔴 Confirm the quote flips to "deposit paid" / success state. If Stripe shows the payment but the app doesn't update → webhook secret wrong (Phase 5). Check Stripe Dashboard → Webhooks → your endpoint → recent deliveries for 200 vs 4xx responses.
  - [ ] Confirm the success page renders.
  - [ ] Confirm the GHL lead was created (check your GHL location).
  - [ ] Confirm the HCP job fired (check the Make.com scenario run / HousecallPro).
- [ ] **Admin** (`/admin`) — 🔴 reachable from your allowlisted IP, blocked otherwise. Quote you just created appears in the list with the correct price and margin panel.
- [ ] **Photo upload** (on `/draw`) — upload a test photo; confirm it stores (Supabase `quote-photos` bucket) and the AI audit runs.

**Verification:** A quote went address → deposit → paid → GHL/HCP, end to end, on the live domain.

---

## Phase 10 — Cutover / Go Live

- [ ] **If you tested on the Vercel URL**, now confirm everything works on the custom domain too (re-run the critical-path subset: address autocomplete, map, deposit).
- [ ] **Refund your test deposit** if you ran a live one.
- [ ] **Set Stripe to live mode** if you tested in test mode (swap keys per Phase 5, re-register webhook, redeploy, re-run the deposit test once with a real card).
- [ ] **Remove any "preview/staging" noindex** if you added one, OR confirm `robots`/`sitemap` are correct for a public launch.
- [ ] **Point your ad traffic / first leads at `https://fenceprostulsa.com`.**

---

## Rollback Plan

If something breaks badly after cutover:

- **Bad deploy:** Vercel → Deployments → find the last-good deployment → "Promote to Production." Instant rollback, no rebuild.
- **Bad env var:** fix in Vercel → redeploy (or promote a prior good deployment).
- **Bad DNS:** Cloudflare changes revert fast; lower TTL to 5 min during cutover so mistakes propagate out quickly.
- **Bad migration:** this is the dangerous one — schema rollbacks against a DB with real data are painful. This is the argument for taking a Supabase snapshot/backup immediately before any post-launch migration. Supabase Dashboard → Database → Backups.
- **Payment issue:** if deposits are failing, you can temporarily disable the lock-in CTA (feature flag or quick deploy) so you stop taking money that doesn't confirm, rather than collecting deposits you can't fulfill.

---

## What's Truly Required vs What Can Wait

If you want the **minimum viable live funnel** today and to harden the rest with traffic flowing, here's the cut:

**Required to take a real deposit (do not skip):**
Phases 0, 1, 2, 3, 4 (Google + Mapbox allowlists), 5 (Stripe webhook), 8 (domain + SSL), 9 (smoke test), 10.

**Can follow within days of launch:**
- Phase 6 email domain — until verified, quotes still email from `onboarding@resend.dev` (works, just not branded).
- Phase 7 crons — abandoned-cart recovery is nice-to-have; the funnel takes deposits without it. But confirm the `CRON_SECRET` auth so the endpoints aren't publicly hammerable.
- Sentry / error monitoring (not in this runbook, but add it the week after launch — your handoff notes there's none, and you'll want it the first time a customer hits a 500 you don't see).
- Rate limiter → Upstash Redis (handoff notes it's in-memory and resets on cold start — fine at launch volume, revisit when traffic grows).

---

## Post-Launch Week 1

- [ ] Add Sentry (or Vercel's built-in error monitoring) — you're now flying blind on production errors without it.
- [ ] Watch the first 5–10 real quotes end to end in the admin panel. Note where customers abandon.
- [ ] Confirm the abandoned-cart cron is actually firing (Vercel cron logs + did the SMS/GHL nudge go out).
- [ ] Spot-check the Wisetack monthly math against a real Wisetack quote (handoff flagged this as unverified).
- [ ] Reconcile any remaining $100 gate / slope discrepancy if you deferred it.
- [ ] Take a Supabase backup before the next schema change.

---

*Built for QuoteOS / FencePros Tulsa. Keep this file in the repo root next to HANDOFF.md and CLAUDE.md. Update it as the deploy process changes.*
