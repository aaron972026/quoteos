import type { GateType, SkuFamily } from "@/lib/pricing/types";
import type { BomBundle, BomInputs, BomLine } from "./types";

/**
 * Pure BOM generator. Same input → same output, no I/O.
 *
 * Formulas are approximations sourced from installer rules of thumb:
 *  - 8 ft post spacing for wood / ornamental
 *  - 10 ft for chain link
 *  - 1.5 bags of concrete (60 lb) per post
 *  - 2 pickets per LF for cedar privacy (1.5" pickets + 0.5" spacing)
 *  - +2 posts per gate (hinge + latch sides) for double gates, +1 for single
 *
 * The numbers should be re-tuned by an installer once we have job-cost data
 * — they're a starting point, not authoritative.
 */

// ─── Constants ─────────────────────────────────────────────────────

const POST_SPACING_FT: Record<SkuFamily, number> = {
  CPF: 8,
  HCF: 8,
  CL: 10,
  RR: 8,
  BP: 8,
};

const POSTS_PER_GATE: Record<GateType, number> = {
  W4: 2,
  W5: 2,
  D10: 3,
  D12: 3,
  D16: 3,
};

const FAMILY_LABEL: Record<SkuFamily, string> = {
  CPF: "Cedar Privacy",
  HCF: "Horizontal Cedar",
  CL: "Chain Link",
  RR: "Ranch Rail",
  BP: "Budget Pine",
};

// ─── Helpers ───────────────────────────────────────────────────────

function ceil(n: number): number {
  return Math.ceil(n);
}

function postCount(family: SkuFamily, linearFeet: number, cornerCount: number): number {
  // One post every spacing ft, plus end-cap post, plus an extra at each
  // corner beyond what continuous spacing already gives you.
  const spacing = POST_SPACING_FT[family];
  return ceil(linearFeet / spacing) + 1 + Math.max(0, cornerCount);
}

function gatePostsExtra(gates: BomInputs["gates"]): number {
  let extra = 0;
  for (const g of gates) extra += POSTS_PER_GATE[g.type] * g.count;
  return extra;
}

function totalPosts(inputs: BomInputs): number {
  return postCount(inputs.family, inputs.linearFeet, inputs.cornerCount) + gatePostsExtra(inputs.gates);
}

/** Effective fence height for material calcs — handles 6→8 ft upgrade. */
function effectiveHeightFt(inputs: BomInputs): number {
  const base = inputs.heightInches / 12;
  if (inputs.heightUpgrade && (inputs.family === "CPF" || inputs.family === "HCF")) {
    return Math.max(base, 8);
  }
  return base;
}

// ─── Family-specific builders ──────────────────────────────────────

function bomCedarPrivacy(inputs: BomInputs): BomBundle["sections"] {
  const lf = inputs.linearFeet;
  const posts = totalPosts(inputs);
  const heightFt = effectiveHeightFt(inputs);
  const tallPost = heightFt >= 8;
  // 3-rail is the new standard across all Cedar Privacy SKUs (post 2-rail drop).
  // CPF-EST adds a kickboard line below for board-on-board construction.
  const sku = inputs.skuCode;
  const railCount = 3;

  const framing: BomLine[] = [
    {
      sku: tallPost ? "POST-4X4-10-CDR" : "POST-4X4-8-CDR",
      description: tallPost ? "4×4×10' cedar post" : "4×4×8' cedar post",
      qty: posts,
      unit: "ea",
    },
    {
      sku: "RAIL-2X4-12-CDR",
      description: "2×4×12' cedar rail",
      qty: ceil((lf / 12) * railCount),
      unit: "ea",
    },
  ];

  // CPF-EST is board-on-board with kickboard — extra picket layer.
  if (sku === "CPF-EST") {
    framing.push({
      sku: "KICKBOARD-2X8-CDR",
      description: "2×8 cedar kickboard",
      qty: ceil(lf / 12),
      unit: "ea",
    });
  }

  const pickets: BomLine[] = [
    {
      sku: inputs.frenchGothic ? "PICKET-6X6-GOTHIC-CDR" : "PICKET-6X6-DOGEAR-CDR",
      description: `6"×${heightFt.toFixed(0)}' cedar picket${inputs.frenchGothic ? " (French Gothic)" : " (dog-ear)"}`,
      qty: ceil(lf * 2), // 6"-wide pickets with ~0.5" gap → 2 per LF
      unit: "ea",
    },
  ];

  const hardware: BomLine[] = [
    {
      sku: "CONC-60LB",
      description: "60 lb bag, fast-set concrete",
      qty: ceil(posts * 1.5),
      unit: "bag",
    },
    {
      sku: "SCREW-DECK-3IN-5LB",
      description: '3" exterior deck screws (5 lb box)',
      qty: ceil(lf / 80),
      unit: "box",
    },
    {
      sku: "NAILS-RING-2.5IN-5LB",
      description: '2½" ring-shank picket nails (5 lb box)',
      qty: ceil(lf / 50),
      unit: "box",
    },
  ];

  const gates = bomGates(inputs);
  const finish = bomFinish(inputs, lf * heightFt);

  return [
    { label: "Framing", lines: framing },
    { label: "Pickets", lines: pickets },
    { label: "Hardware", lines: hardware },
    ...(gates.length > 0 ? [{ label: "Gates", lines: gates }] : []),
    ...(finish.length > 0 ? [{ label: "Finish", lines: finish }] : []),
  ];
}

function bomHorizontalCedar(inputs: BomInputs): BomBundle["sections"] {
  const lf = inputs.linearFeet;
  const posts = totalPosts(inputs);
  const heightFt = effectiveHeightFt(inputs);
  // Horizontal slats: 1×6 cedar, run continuously. Slat count = height / 6.5"
  // (6" board + 0.5" reveal gap), times LF / 16 (board length).
  const slatsPerPanel = ceil((heightFt * 12) / 6.5);

  // HCF-PRM uses hidden fasteners; both variants use wood posts by default.
  const isPrm = inputs.skuCode === "HCF-PRM";

  const framing: BomLine[] = [
    {
      sku: heightFt >= 8 ? "POST-4X4-10-CDR" : "POST-4X4-8-CDR",
      description: heightFt >= 8 ? "4×4×10' cedar post" : "4×4×8' cedar post",
      qty: posts,
      unit: "ea",
    },
  ];

  const slats: BomLine[] = [
    {
      sku: "BOARD-1X6-16-CDR",
      description: "1×6×16' clear cedar slat",
      qty: ceil((lf / 16) * slatsPerPanel),
      unit: "ea",
    },
  ];
  if (isPrm) {
    slats.push({
      sku: "HID-FASTENER-CLIP",
      description: "Hidden fastener clip (HCF-PRM)",
      qty: ceil(lf * slatsPerPanel * 0.5),
      unit: "ea",
      note: "Two clips per slat per post on average.",
    });
  }

  const hardware: BomLine[] = [
    {
      sku: "CONC-60LB",
      description: "60 lb bag, fast-set concrete",
      qty: ceil(posts * 1.5),
      unit: "bag",
    },
    {
      sku: "SCREW-DECK-2.5IN-5LB",
      description: '2½" exterior deck screws (5 lb box)',
      qty: ceil(lf / 60),
      unit: "box",
    },
  ];

  const gates = bomGates(inputs);
  const finish = bomFinish(inputs, lf * heightFt);

  return [
    { label: "Framing", lines: framing },
    { label: "Slats", lines: slats },
    { label: "Hardware", lines: hardware },
    ...(gates.length > 0 ? [{ label: "Gates", lines: gates }] : []),
    ...(finish.length > 0 ? [{ label: "Finish", lines: finish }] : []),
  ];
}

function bomChainLink(inputs: BomInputs): BomBundle["sections"] {
  const lf = inputs.linearFeet;
  const posts = totalPosts(inputs);
  const heightFt = inputs.heightInches / 12;
  // CL-RES = galvanized residential, CL-VIN = black PVC-coated.
  const isVinyl = inputs.skuCode === "CL-VIN";

  const framing: BomLine[] = [
    {
      sku: "POST-CL-1-5/8-RES",
      description: '1-5/8" galvanized line post',
      qty: posts,
      unit: "ea",
    },
    {
      sku: "RAIL-TOP-CL-21FT",
      description: "Top rail, galvanized, 21 ft",
      qty: ceil(lf / 21),
      unit: "ea",
    },
  ];
  if (isVinyl) {
    framing.push({
      sku: "RAIL-BOTTOM-TENSION",
      description: "Bottom tension wire, 7 ga galv (1320 ft coil)",
      qty: ceil(lf / 1320),
      unit: "ea",
    });
  }

  const fabric: BomLine[] = [
    {
      sku: isVinyl ? "FABRIC-CL-9GA-PVC-50FT" : "FABRIC-CL-11.5GA-50FT",
      description: `${heightFt.toFixed(0)}' chain-link fabric, ${
        isVinyl ? "9 ga PVC-coated" : "11.5 ga galv"
      } (50 ft roll)`,
      qty: ceil(lf / 50),
      unit: "ea",
    },
  ];

  const hardware: BomLine[] = [
    {
      sku: "CONC-60LB",
      description: "60 lb bag, fast-set concrete",
      qty: ceil(posts * 1.5),
      unit: "bag",
    },
    {
      sku: "TIE-WIRE-GALV-100PK",
      description: "Galvanized tie wires (100-pack)",
      qty: ceil(lf / 25),
      unit: "box",
    },
    {
      sku: "POST-CAP-CL",
      description: "Galv post cap",
      qty: posts,
      unit: "ea",
    },
  ];

  const gates = bomGates(inputs);
  return [
    { label: "Framing", lines: framing },
    { label: "Fabric", lines: fabric },
    { label: "Hardware", lines: hardware },
    ...(gates.length > 0 ? [{ label: "Gates", lines: gates }] : []),
  ];
}

// Ornamental Metal removed from product line in pricing model v2.
// The bomOrnamental helper was deleted with that family.

function bomRanchRail(inputs: BomInputs): BomBundle["sections"] {
  const lf = inputs.linearFeet;
  const posts = totalPosts(inputs);
  const heightFt = inputs.heightInches / 12;
  // Rail count comes from SKU code: RR-3 / RR-4 → 3 or 4 rails. (RR-2 retired.)
  const railMatch = inputs.skuCode.match(/RR-(\d+)/);
  const rails = railMatch ? Number(railMatch[1]) : 3;

  const framing: BomLine[] = [
    {
      sku: "POST-RR-RND-8FT",
      description: "Cedar round rail post, 8 ft",
      qty: posts,
      unit: "ea",
    },
    {
      sku: "RAIL-RR-CDR-10FT",
      description: "Cedar split rail, 10 ft",
      qty: ceil((lf / 10) * rails),
      unit: "ea",
    },
  ];

  // Mesh insert added on the 4-rail SKU (RR-4) — replaces the legacy
  // "better/best tier" gate.
  if (rails >= 4) {
    framing.push({
      sku: "MESH-GALV-2X4-WIRE-100FT",
      description: '2"×4" welded wire mesh insert (100 ft roll)',
      qty: ceil(lf / 100),
      unit: "ea",
    });
  }

  const hardware: BomLine[] = [
    {
      sku: "CONC-60LB",
      description: "60 lb bag, fast-set concrete",
      qty: ceil(posts * 1.0),
      unit: "bag",
      note: "Ranch posts set shallower; 1 bag/post is enough on most soils.",
    },
  ];

  const gates = bomGates(inputs);
  const finish = bomFinish(inputs, lf * heightFt * 0.5); // open style — less surface
  return [
    { label: "Framing", lines: framing },
    { label: "Hardware", lines: hardware },
    ...(gates.length > 0 ? [{ label: "Gates", lines: gates }] : []),
    ...(finish.length > 0 ? [{ label: "Finish", lines: finish }] : []),
  ];
}

// ─── Shared sub-builders ───────────────────────────────────────────

function bomGates(inputs: BomInputs): BomLine[] {
  if (inputs.gates.length === 0) return [];
  const out: BomLine[] = [];
  for (const g of inputs.gates) {
    if (g.count <= 0) continue;
    out.push({
      sku: `GATE-FRAME-${g.type}`,
      description: `${g.type} gate frame kit`,
      qty: g.count,
      unit: "ea",
    });
    out.push({
      sku: `GATE-HW-${g.type}`,
      description: `${g.type} gate hardware (hinges + latch)`,
      qty: g.count,
      unit: "ea",
    });
  }
  return out;
}

function bomFinish(inputs: BomInputs, fenceFaceSqft: number): BomLine[] {
  if (!inputs.stainSeal) return [];
  // Manufacturer-typical coverage ~200 sqft/gal × 2 coats = 100 sqft/gal effective
  const gallons = ceil(fenceFaceSqft / 100);
  return [
    {
      sku: "STAIN-CDR-GAL",
      description: "Penetrating cedar stain / sealer",
      qty: gallons,
      unit: "gal",
    },
  ];
}

// ─── Public API ────────────────────────────────────────────────────

export function generateBom(inputs: BomInputs): BomBundle {
  const warnings: string[] = [];
  if (inputs.linearFeet <= 0) {
    warnings.push("BOM_NO_LF: linear_feet is zero — BOM will be empty.");
    return { inputs, sections: [], allLines: [], warnings };
  }
  if (inputs.heightUpgrade && inputs.family !== "CPF" && inputs.family !== "HCF") {
    warnings.push(
      `BOM_HEIGHT_UPGRADE_IGNORED: height upgrade not available for family ${inputs.family}.`
    );
  }

  let sections: BomBundle["sections"];
  switch (inputs.family) {
    case "CPF":
      sections = bomCedarPrivacy(inputs);
      break;
    case "HCF":
      sections = bomHorizontalCedar(inputs);
      break;
    case "CL":
      sections = bomChainLink(inputs);
      break;
    case "RR":
      sections = bomRanchRail(inputs);
      break;
    case "BP":
      // Budget Pine builds identically to a CPF (wood pickets, 3-rail) — the
      // difference is material grade (KDAT pine vs cedar), priced at the SKU
      // level. The BOM rules don't need a separate generator.
      sections = bomCedarPrivacy(inputs);
      break;
    default:
      warnings.push(`BOM_UNKNOWN_FAMILY: ${inputs.family} has no rules — empty BOM.`);
      sections = [];
  }

  const allLines = sections.flatMap((s) => s.lines);
  return { inputs, sections, allLines, warnings };
}

export { FAMILY_LABEL };
