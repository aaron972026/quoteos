import { describe, expect, it } from "vitest";
import { quoteRef, refToIdPrefix } from "./quote-ref";

describe("quoteRef", () => {
  it("builds IV- plus the uppercased UUID prefix when no quote number is stored", () => {
    expect(quoteRef({ id: "3bc1f0fe-1111-2222-3333-444455556666" })).toBe("IV-3BC1F0FE");
  });

  it("prefers a stored quote number", () => {
    expect(quoteRef({ id: "3bc1f0fe-1111", quoteNumber: "IV-0001" })).toBe("IV-0001");
  });
});

describe("refToIdPrefix", () => {
  it("accepts IV-, legacy FP-, or bare hex, case-insensitively", () => {
    expect(refToIdPrefix("IV-3BC1F0FE")).toBe("3bc1f0fe");
    expect(refToIdPrefix("fp-3bc1f0fe")).toBe("3bc1f0fe");
    expect(refToIdPrefix(" 3bc1f0fe ")).toBe("3bc1f0fe");
  });

  it("returns null for anything that isn't a reference", () => {
    expect(refToIdPrefix("123 Main St")).toBeNull();
    expect(refToIdPrefix("IV-3BC1")).toBeNull();
  });
});
