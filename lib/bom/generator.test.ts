import { describe, expect, it } from "vitest";
import { generateBom } from "./generator";
import type { BomInputs } from "./types";

function input(over: Partial<BomInputs> = {}): BomInputs {
  return {
    family: "CPF",
    skuCode: "CPF-PRM",
    heightInches: 72,
    heightUpgrade: false,
    frenchGothic: false,
    stainSeal: false,
    linearFeet: 100,
    cornerCount: 4,
    gates: [],
    ...over,
  };
}

function findLine(bundle: ReturnType<typeof generateBom>, skuPrefix: string) {
  return bundle.allLines.find((l) => l.sku.startsWith(skuPrefix));
}

describe("generateBom — cedar privacy (CPF)", () => {
  it("posts: 100 LF / 8 ft + 1 cap + 4 corners = 18 posts", () => {
    const b = generateBom(input({ linearFeet: 100, cornerCount: 4 }));
    const posts = findLine(b, "POST-4X4");
    expect(posts?.qty).toBe(18);
  });

  it("pickets: 2 per LF", () => {
    const b = generateBom(input({ linearFeet: 100 }));
    const pickets = findLine(b, "PICKET-6X6");
    expect(pickets?.qty).toBe(200);
  });

  it("all Cedar Privacy SKUs use 3 rails (2-rail variant retired)", () => {
    const pine = generateBom(input({ skuCode: "CPF-PINE" }));
    const prm = generateBom(input({ skuCode: "CPF-PRM" }));
    expect(findLine(prm, "RAIL-2X4")!.qty).toBe(
      findLine(pine, "RAIL-2X4")!.qty
    );
  });

  it("CPF-EST adds a kickboard line (board-on-board)", () => {
    const est = generateBom(input({ skuCode: "CPF-EST" }));
    expect(findLine(est, "KICKBOARD-")).toBeDefined();
  });

  it("french_gothic switches picket SKU", () => {
    const dogear = generateBom(input({ frenchGothic: false }));
    const gothic = generateBom(input({ frenchGothic: true }));
    expect(findLine(dogear, "PICKET-6X6")?.sku).toContain("DOGEAR");
    expect(findLine(gothic, "PICKET-6X6")?.sku).toContain("GOTHIC");
  });

  it("height_upgrade switches to 10' posts on CPF", () => {
    const base = generateBom(input({ heightUpgrade: false }));
    const tall = generateBom(input({ heightUpgrade: true }));
    expect(findLine(base, "POST-4X4")?.sku).toBe("POST-4X4-8-CDR");
    expect(findLine(tall, "POST-4X4")?.sku).toBe("POST-4X4-10-CDR");
  });

  it("stain_seal adds gallons of stain proportional to face area", () => {
    const dry = generateBom(input({ stainSeal: false, linearFeet: 100 }));
    const wet = generateBom(input({ stainSeal: true, linearFeet: 100 }));
    expect(findLine(dry, "STAIN-")).toBeUndefined();
    const stain = findLine(wet, "STAIN-")!;
    expect(stain.qty).toBe(6);
  });

  it("gates add 2 extra posts per single + frame/hardware lines", () => {
    const noGates = generateBom(input({ gates: [] }));
    const oneGate = generateBom(input({ gates: [{ type: "W4", count: 1 }] }));
    const baseP = findLine(noGates, "POST-4X4")!.qty;
    const gateP = findLine(oneGate, "POST-4X4")!.qty;
    expect(gateP - baseP).toBe(2);
    expect(findLine(oneGate, "GATE-FRAME-W4")?.qty).toBe(1);
    expect(findLine(oneGate, "GATE-HW-W4")?.qty).toBe(1);
  });
});

describe("generateBom — chain link (CL)", () => {
  it("uses 10 ft post spacing", () => {
    const b = generateBom(
      input({
        family: "CL",
        skuCode: "CL-RES",
        linearFeet: 100,
        cornerCount: 0,
      })
    );
    expect(findLine(b, "POST-CL-")?.qty).toBe(11);
  });

  it("CL-RES uses 11.5 ga galv fabric; CL-VIN uses 9 ga PVC", () => {
    const res = generateBom(input({ family: "CL", skuCode: "CL-RES" }));
    const vin = generateBom(input({ family: "CL", skuCode: "CL-VIN" }));
    expect(findLine(res, "FABRIC-CL-")?.sku).toContain("11.5GA");
    expect(findLine(vin, "FABRIC-CL-")?.sku).toContain("PVC");
  });

  it("CL-VIN adds bottom tension wire; CL-RES does not", () => {
    const res = generateBom(input({ family: "CL", skuCode: "CL-RES" }));
    const vin = generateBom(input({ family: "CL", skuCode: "CL-VIN" }));
    expect(findLine(res, "RAIL-BOTTOM")).toBeUndefined();
    expect(findLine(vin, "RAIL-BOTTOM")).toBeDefined();
  });
});

describe("generateBom — ranch rail (RR)", () => {
  it("RR-4 has more rails than RR-3", () => {
    const rr3 = generateBom(input({ family: "RR", skuCode: "RR-3" }));
    const rr4 = generateBom(input({ family: "RR", skuCode: "RR-4" }));
    expect(findLine(rr4, "RAIL-RR")!.qty).toBeGreaterThan(
      findLine(rr3, "RAIL-RR")!.qty
    );
  });

  it("RR-4 adds welded wire mesh insert; RR-3 does not", () => {
    const rr3 = generateBom(input({ family: "RR", skuCode: "RR-3" }));
    const rr4 = generateBom(input({ family: "RR", skuCode: "RR-4" }));
    expect(findLine(rr3, "MESH-")).toBeUndefined();
    expect(findLine(rr4, "MESH-")).toBeDefined();
  });
});

describe("generateBom — empty/edge", () => {
  it("returns empty bundle for zero LF", () => {
    const b = generateBom(input({ linearFeet: 0 }));
    expect(b.allLines).toHaveLength(0);
    expect(b.warnings.some((w) => w.startsWith("BOM_NO_LF"))).toBe(true);
  });

  it("warns when height_upgrade is set on a family that doesn't support it", () => {
    const b = generateBom(
      input({ family: "CL", skuCode: "CL-RES", heightUpgrade: true })
    );
    expect(
      b.warnings.some((w) => w.startsWith("BOM_HEIGHT_UPGRADE_IGNORED"))
    ).toBe(true);
  });
});
