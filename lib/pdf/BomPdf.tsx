import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { FAMILY_LABEL } from "@/lib/bom/generator";
import type { BomBundle, BomLine } from "@/lib/bom/types";
import { getBrandLogoBuffer } from "./brand-logo";

const NAVY = "#1F3A5F";
const ACCENT = "#F4A623";
const MUTED = "#1F3A5F99";
const LINE = "#1F3A5F26";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, color: NAVY, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  badge: {
    backgroundColor: NAVY,
    color: "#fff",
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  h1: { fontSize: 18, fontWeight: "bold", marginTop: 4 },
  sub: { fontSize: 10, color: MUTED, marginTop: 1 },
  meta: { fontSize: 9, color: MUTED, marginTop: 4 },
  sectionLabel: {
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 4,
  },
  tableHead: {
    flexDirection: "row",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  th: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  cell: { fontSize: 10, color: NAVY },
  qtyCol: { width: 50, textAlign: "right" },
  unitCol: { width: 40 },
  skuCol: { width: 140 },
  descCol: { flex: 1 },
  noteText: { fontSize: 8, color: MUTED, marginTop: 1 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  totalLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1 },
  totalValue: { fontSize: 14, fontWeight: "bold", color: NAVY, marginTop: 2 },
  warnBox: {
    backgroundColor: "#FEF3C7",
    padding: 6,
    marginTop: 10,
    borderRadius: 3,
  },
  warnText: { fontSize: 9, color: "#92400E" },
  checkboxCol: { width: 14 },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: NAVY,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 28,
    right: 28,
    fontSize: 7,
    color: MUTED,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 6,
  },
  pill: {
    backgroundColor: ACCENT,
    color: NAVY,
    fontSize: 7,
    fontWeight: "bold",
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
  },
});

export interface BomPdfData {
  quoteNumber: string | null;
  quoteId: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  bom: BomBundle;
}

function totalUnits(lines: BomLine[]): { count: number; eaCount: number } {
  let count = 0;
  let eaCount = 0;
  for (const l of lines) {
    count++;
    if (l.unit === "ea") eaCount += l.qty;
  }
  return { count, eaCount };
}

export function BomPdf({ data }: { data: BomPdfData }) {
  const { bom } = data;
  const totals = totalUnits(bom.allLines);
  const issuedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const address = [data.addressLine, data.city, data.state, data.zip]
    .filter(Boolean)
    .join(", ");

  const logo = getBrandLogoBuffer();

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            {logo && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logo} style={{ height: 22, width: "auto", marginBottom: 4 }} />
            )}
            <Text style={styles.badge}>YARD PULL LIST</Text>
            <Text style={styles.h1}>
              {FAMILY_LABEL[bom.inputs.family]} ·{" "}
              {bom.inputs.linearFeet.toFixed(0)} LF
            </Text>
            <Text style={styles.sub}>
              {address || "(no address)"}
            </Text>
            <Text style={styles.meta}>
              Quote {data.quoteNumber ?? data.quoteId} · {issuedAt}
            </Text>
          </View>
          <View>
            <Text style={styles.pill}>{bom.inputs.skuCode.toUpperCase()}</Text>
            {bom.inputs.heightUpgrade && (
              <Text style={[styles.pill, { marginTop: 4 }]}>HEIGHT UPGRADE</Text>
            )}
          </View>
        </View>

        {bom.warnings.length > 0 && (
          <View style={styles.warnBox}>
            {bom.warnings.map((w) => (
              <Text key={w} style={styles.warnText}>
                {w}
              </Text>
            ))}
          </View>
        )}

        {bom.sections.map((section) => (
          <View key={section.label}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.checkboxCol]}> </Text>
              <Text style={[styles.th, styles.qtyCol]}>Qty</Text>
              <Text style={[styles.th, styles.unitCol]}>Unit</Text>
              <Text style={[styles.th, styles.skuCol]}>SKU</Text>
              <Text style={[styles.th, styles.descCol]}>Description</Text>
            </View>
            {section.lines.map((line) => (
              <View key={`${section.label}-${line.sku}`} style={styles.row}>
                <View style={styles.checkboxCol}>
                  <View style={styles.checkbox} />
                </View>
                <Text style={[styles.cell, styles.qtyCol]}>{line.qty}</Text>
                <Text style={[styles.cell, styles.unitCol]}>{line.unit}</Text>
                <Text style={[styles.cell, styles.skuCol, { fontSize: 8 }]}>
                  {line.sku}
                </Text>
                <View style={styles.descCol}>
                  <Text style={styles.cell}>{line.description}</Text>
                  {line.note && <Text style={styles.noteText}>{line.note}</Text>}
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.totalsRow}>
          <View>
            <Text style={styles.totalLabel}>Line items</Text>
            <Text style={styles.totalValue}>{totals.count}</Text>
          </View>
          <View>
            <Text style={styles.totalLabel}>Total each-units</Text>
            <Text style={styles.totalValue}>{totals.eaCount.toFixed(0)}</Text>
          </View>
          <View>
            <Text style={styles.totalLabel}>Corners</Text>
            <Text style={styles.totalValue}>{bom.inputs.cornerCount}</Text>
          </View>
          <View>
            <Text style={styles.totalLabel}>Gates</Text>
            <Text style={styles.totalValue}>
              {bom.inputs.gates.reduce((s, g) => s + g.count, 0)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Formulas are starting-point estimates — verify against yard pricing.
          Quote {data.quoteNumber ?? data.quoteId} · {issuedAt}
        </Text>
      </Page>
    </Document>
  );
}
