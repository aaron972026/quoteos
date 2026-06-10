import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { BUSINESS } from "@/lib/business";
import { getBrandLogoBuffer } from "./brand-logo";

const NAVY = "#1A2A4A";
const BRICK = "#8B2332";
const BRASS = "#C8962E";
const MUTED = "#1A2A4A99";
const LINE = "#1A2A4A26";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, color: NAVY, fontFamily: "Helvetica" },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 6,
  },
  brandLogo: { height: 28, width: "auto" },
  brandBadge: {
    backgroundColor: NAVY,
    color: BRASS,
    fontWeight: "bold",
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 1,
  },
  brandCity: { fontSize: 10, color: MUTED },
  spec: {
    fontSize: 9,
    color: BRICK,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  h1: { fontSize: 22, fontWeight: "bold", color: NAVY, marginBottom: 2 },
  sub: { fontSize: 11, color: MUTED, marginBottom: 16 },
  sectionLabel: {
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
  },
  priceCard: {
    borderWidth: 1,
    borderColor: LINE,
    borderTopWidth: 3,
    borderTopColor: BRASS,
    padding: 16,
    marginTop: 4,
  },
  priceRangeLabel: {
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  priceRangeRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 6,
    gap: 8,
  },
  priceLow: { fontSize: 28, fontWeight: "bold", color: BRICK },
  priceDash: { fontSize: 22, color: MUTED },
  priceHigh: { fontSize: 28, fontWeight: "bold", color: BRICK },
  priceHelper: { fontSize: 9, color: MUTED, marginTop: 8 },
  scopeRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 4,
  },
  scopeLabel: { width: 110, color: MUTED },
  scopeValue: { flex: 1, color: NAVY },
  bdRow: { flexDirection: "row", paddingVertical: 2 },
  bdLabel: { flex: 1, color: MUTED, fontSize: 10 },
  bdValue: { color: NAVY, fontSize: 10 },
  totalRow: {
    flexDirection: "row",
    paddingTop: 6,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  totalLabel: { flex: 1, color: NAVY, fontWeight: "bold", fontSize: 11 },
  totalValue: { color: BRICK, fontWeight: "bold", fontSize: 14 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: MUTED,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 8,
  },
});

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export interface QuotePdfData {
  quoteNumber: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  linearFeet: number;
  cornerCount: number;
  skuCode: string;
  familyName: string;
  demoRequired: boolean;
  heightUpgrade: boolean;
  frenchGothic: boolean;
  stainSeal: boolean;
  steelPostUpgrade?: boolean;
  finalPriceCents: number;
  displayRangeLowCents: number;
  displayRangeHighCents: number;
  breakdown: {
    base_fence_cents: number;
    slope_surcharge_cents: number;
    access_surcharge_cents: number;
    steel_upgrade_cents: number;
    // Newer engine lines — optional so older call sites keep compiling.
    ironclad_cents?: number;
    board_on_board_cents?: number;
    cap_rail_cents?: number;
    match_vinyl_posts_cents?: number;
    gates_cents: number;
    demo_cents: number;
    stain_cents: number;
    rock_drilling_cents: number;
    tear_concrete_cents: number;
    permit_cents: number;
  };
  // Admin price override delta (persisted total − engine-derived total).
  // Rendered as its own breakdown line so the itemization always sums to
  // the printed Total, even after a manual adjustment or for options the
  // quote row doesn't persist as columns.
  adjustmentCents?: number;
  validUntil: string;
}

export function QuotePdf({ data }: { data: QuotePdfData }) {
  const issuedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const validDate = new Date(data.validUntil).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const breakdownItems = (
    [
      ["Base fence", data.breakdown.base_fence_cents],
      ["Ironclad Install", data.breakdown.ironclad_cents ?? 0],
      ["Steel post upgrade", data.breakdown.steel_upgrade_cents],
      ["Board-on-board privacy", data.breakdown.board_on_board_cents ?? 0],
      ["Cap rail + trim", data.breakdown.cap_rail_cents ?? 0],
      ["Black vinyl posts", data.breakdown.match_vinyl_posts_cents ?? 0],
      ["Gates", data.breakdown.gates_cents],
      ["Tear-out & haul", data.breakdown.demo_cents],
      ["Stain & seal", data.breakdown.stain_cents],
      ["Rock drilling", data.breakdown.rock_drilling_cents],
      ["Concrete-post removal", data.breakdown.tear_concrete_cents],
      ["Permit", data.breakdown.permit_cents],
    ] as Array<[string, number]>
  )
    .concat(
      data.adjustmentCents != null && data.adjustmentCents !== 0
        ? [["Selected options & adjustments", data.adjustmentCents]]
        : []
    )
    .filter(([, v]) => v !== 0);

  const logo = getBrandLogoBuffer();
  const specLine = [
    data.quoteNumber ? `QUOTE #${data.quoteNumber}` : null,
    `${data.linearFeet.toFixed(0)} LF`,
    data.familyName.toUpperCase(),
    data.skuCode,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.brand}>
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logo} style={styles.brandLogo} />
          ) : (
            <>
              <Text style={styles.brandBadge}>FENCEPROS</Text>
              <Text style={styles.brandCity}>TULSA</Text>
            </>
          )}
        </View>

        <Text style={styles.spec}>{specLine}</Text>
        <Text style={styles.h1}>Your fence quote</Text>
        <Text style={styles.sub}>
          {data.addressLine ?? ""}
          {data.city ? `, ${data.city}` : ""}
          {data.state ? `, ${data.state}` : ""}
          {data.zip ? ` ${data.zip}` : ""}
        </Text>

        <View style={styles.priceCard}>
          <Text style={styles.priceRangeLabel}>Your range</Text>
          <View style={styles.priceRangeRow}>
            <Text style={styles.priceLow}>{fmt(data.displayRangeLowCents)}</Text>
            <Text style={styles.priceDash}>–</Text>
            <Text style={styles.priceHigh}>{fmt(data.displayRangeHighCents)}</Text>
          </View>
          <Text style={styles.priceHelper}>
            Final price falls inside this range after a quick site verification — and
            won&apos;t exceed the maximum. If we measure shorter, you pay less.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Scope</Text>
        <View style={styles.scopeRow}>
          <Text style={styles.scopeLabel}>Linear feet</Text>
          <Text style={styles.scopeValue}>
            {data.linearFeet.toFixed(0)} LF · {data.cornerCount} corners
          </Text>
        </View>
        <View style={styles.scopeRow}>
          <Text style={styles.scopeLabel}>Style</Text>
          <Text style={styles.scopeValue}>
            {data.familyName} · {data.skuCode}
          </Text>
        </View>
        {data.heightUpgrade && (
          <View style={styles.scopeRow}>
            <Text style={styles.scopeLabel}>Height</Text>
            <Text style={styles.scopeValue}>8&apos; tall (upgraded)</Text>
          </View>
        )}
        {data.frenchGothic && (
          <View style={styles.scopeRow}>
            <Text style={styles.scopeLabel}>Top</Text>
            <Text style={styles.scopeValue}>French Gothic</Text>
          </View>
        )}
        {data.steelPostUpgrade && (
          <View style={styles.scopeRow}>
            <Text style={styles.scopeLabel}>Posts</Text>
            <Text style={styles.scopeValue}>Steel-post upgrade (15-yr structural)</Text>
          </View>
        )}
        {data.stainSeal && (
          <View style={styles.scopeRow}>
            <Text style={styles.scopeLabel}>Stain & seal</Text>
            <Text style={styles.scopeValue}>Included</Text>
          </View>
        )}
        {data.demoRequired && (
          <View style={styles.scopeRow}>
            <Text style={styles.scopeLabel}>Tear-out</Text>
            <Text style={styles.scopeValue}>Existing fence removed & hauled</Text>
          </View>
        )}

        {breakdownItems.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Itemized breakdown</Text>
            {breakdownItems.map(([label, cents]) => (
              <View key={label} style={styles.bdRow}>
                <Text style={styles.bdLabel}>{label}</Text>
                <Text style={styles.bdValue}>{fmt(cents)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{fmt(data.finalPriceCents)}</Text>
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Issued {issuedAt} · Price valid through {validDate} ·{" "}
          {BUSINESS.legalName} · Licensed & insured ·{" "}
          {BUSINESS.phone} · {BUSINESS.domain} ·{" "}
          {data.quoteNumber ?? "(quote draft)"}
        </Text>
      </Page>
    </Document>
  );
}
