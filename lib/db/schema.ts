import {
  pgTable,
  uuid,
  text,
  inet,
  timestamp,
  jsonb,
  numeric,
  integer,
  boolean,
  bigserial,
  serial,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "finalized",
  "deposit_paid",
  "won",
  "lost",
  "expired",
]);

export const tierEnum = pgEnum("tier", ["good", "better", "best"]);

export const marginFlagEnum = pgEnum("margin_flag", ["ok", "warn", "low"]);

export const demoTypeEnum = pgEnum("demo_type", [
  "NONE",
  "CEDAR",
  "CHAIN",
  "METAL",
  "CONC",
]);

// ─── Sessions ─────────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fingerprint: text("fingerprint"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    referrer: text("referrer"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    fingerprintIdx: index("sessions_fingerprint_idx").on(t.fingerprint),
    startedAtIdx: index("sessions_started_at_idx").on(t.startedAt),
  })
);

// ─── Quotes ───────────────────────────────────────────────────────────

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteNumber: text("quote_number").unique(),
    sessionId: uuid("session_id").references(() => sessions.id),
    status: quoteStatusEnum("status").notNull().default("draft"),

    // Customer (filled at deposit step)
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),

    // Property
    addressLine: text("address_line"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    parcelId: text("parcel_id"),

    // Scope (drawing result + config)
    geometry: jsonb("geometry"), // GeoJSON LineString or Polygon
    linearFeet: numeric("linear_feet", { precision: 10, scale: 2 }),
    cornerCount: integer("corner_count"),
    slopeCode: integer("slope_code"),
    slopeSelfReported: boolean("slope_self_reported").default(false),
    demoRequired: boolean("demo_required").default(false),
    demoType: demoTypeEnum("demo_type").default("NONE"),

    // SKU & options
    skuCode: text("sku_code"),
    tier: tierEnum("tier"),
    heightUpgrade: boolean("height_upgrade").default(false),
    frenchGothic: boolean("french_gothic").default(false),
    stainSeal: boolean("stain_seal").default(false),

    // Gates: jsonb array of { type, count, position?: { lat, lng } }
    gates: jsonb("gates").$type<
      Array<{ type: string; count: number; position?: { lat: number; lng: number } }>
    >(),

    // Computed pricing (cents)
    subtotalCents: integer("subtotal_cents"),
    tierGoodCents: integer("tier_good_cents"),
    tierBetterCents: integer("tier_better_cents"),
    tierBestCents: integer("tier_best_cents"),
    selectedTierCents: integer("selected_tier_cents"),
    depositCents: integer("deposit_cents"),
    monthly24moCents: integer("monthly_24mo_cents"),

    // Margin (internal — never returned to client)
    estimatedMaterialCostCents: integer("estimated_material_cost_cents"),
    estimatedSubCostCents: integer("estimated_sub_cost_cents"),
    estimatedGrossMarginPct: numeric("estimated_gross_margin_pct", {
      precision: 5,
      scale: 4,
    }),
    marginFlag: marginFlagEnum("margin_flag"),

    // Pricing version snapshot (audit trail)
    pricingVersionId: uuid("pricing_version_id"),

    // Lifecycle
    priceValidUntil: timestamp("price_valid_until", { withTimezone: true }),
    depositPaidAt: timestamp("deposit_paid_at", { withTimezone: true }),
    stripePaymentIntent: text("stripe_payment_intent"),
    ghlContactId: text("ghl_contact_id"),
    hcpJobId: text("hcp_job_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sessionIdx: index("quotes_session_idx").on(t.sessionId),
    statusIdx: index("quotes_status_idx").on(t.status),
    createdAtIdx: index("quotes_created_at_idx").on(t.createdAt),
    zipIdx: index("quotes_zip_idx").on(t.zip),
  })
);

// ─── Pricing versions (audit) ────────────────────────────────────────

export const pricingVersions = pgTable("pricing_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionNumber: text("version_number").notNull(),
  config: jsonb("config").notNull(), // entire SKU + adjustment table snapshot
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── SKUs ─────────────────────────────────────────────────────────────

export const skus = pgTable("skus", {
  code: text("code").primaryKey(), // e.g. CP-B (cedar privacy, better)
  family: text("family").notNull(), // CP, HC, CL, OR, RR
  familyName: text("family_name").notNull(), // "Cedar Privacy"
  tier: tierEnum("tier").notNull(),
  description: text("description").notNull(),
  heightInches: integer("height_inches").notNull(),
  basePricePerLfCents: integer("base_price_per_lf_cents").notNull(),
  materialCostPerLfCents: integer("material_cost_per_lf_cents").notNull(),
  subLaborPct: numeric("sub_labor_pct", { precision: 5, scale: 4 }).notNull(),
  active: boolean("active").notNull().default(true),
  heroImageUrl: text("hero_image_url"),
  specBullets: jsonb("spec_bullets").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Adjustments (slope, demo, gates, add-ons) ───────────────────────

export const adjustments = pgTable("adjustments", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // slope | demo | gate | addon | tier
  code: text("code").notNull(),
  label: text("label").notNull(),
  // Numeric value: multiplier (e.g. 1.18) OR cents amount per unit
  value: numeric("value", { precision: 12, scale: 4 }).notNull(),
  unit: text("unit").notNull(), // multiplier | per_lf | per_each | flat | pct
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata"),
});

// ─── Service zones ────────────────────────────────────────────────────

export const serviceZones = pgTable("service_zones", {
  zip: text("zip").primaryKey(),
  city: text("city").notNull(),
  state: text("state").notNull().default("OK"),
  inPrimary: boolean("in_primary").notNull().default(false),
  inExtended: boolean("in_extended").notNull().default(false),
  travelSurchargePerMileCents: integer("travel_surcharge_per_mile_cents")
    .notNull()
    .default(0),
});

// ─── Quote events (analytics funnel) ──────────────────────────────────

export const quoteEvents = pgTable(
  "quote_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    quoteId: uuid("quote_id").references(() => quotes.id),
    sessionId: uuid("session_id").references(() => sessions.id),
    eventType: text("event_type").notNull(), // step_completed | abandoned | recovered | etc.
    step: text("step"), // address | confirm | draw | configure | quote | deposit
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    quoteIdx: index("quote_events_quote_idx").on(t.quoteId),
    sessionIdx: index("quote_events_session_idx").on(t.sessionId),
    typeIdx: index("quote_events_type_idx").on(t.eventType),
    createdAtIdx: index("quote_events_created_at_idx").on(t.createdAt),
  })
);

// ─── Type exports ─────────────────────────────────────────────────────

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type Sku = typeof skus.$inferSelect;
export type Adjustment = typeof adjustments.$inferSelect;
export type ServiceZone = typeof serviceZones.$inferSelect;
export type QuoteEvent = typeof quoteEvents.$inferSelect;
