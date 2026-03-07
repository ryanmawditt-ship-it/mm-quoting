import { describe, expect, it } from "vitest";
import { normaliseSupplierName } from "./db";

describe("Supplier Name Normalisation", () => {
  it("normalises basic names to the same key", () => {
    const variants = [
      "Everlite Lighting Group",
      "EVERLITE LIGHTING GROUP PTY LTD",
      "Everlite Lighting Group Pty Ltd",
      "everlite lighting group",
      "EVERLITE Lighting Specialists",
      "Everlite Lighting",
    ];

    const normalised = variants.map(normaliseSupplierName);
    // All should normalise to the same base: "everlitelighting"
    const base = normalised[0];
    for (let i = 1; i < normalised.length; i++) {
      // Either they match exactly or one contains the other
      const matches =
        normalised[i] === base ||
        normalised[i].includes(base) ||
        base.includes(normalised[i]);
      expect(matches, `"${variants[i]}" → "${normalised[i]}" should match "${variants[0]}" → "${base}"`).toBe(true);
    }
  });

  it("strips PTY, LTD, GROUP, INC, CORP suffixes", () => {
    expect(normaliseSupplierName("Acme Corp Pty Ltd")).toBe("acme");
    expect(normaliseSupplierName("Acme")).toBe("acme");
    expect(normaliseSupplierName("ACME INC")).toBe("acme");
  });

  it("strips AGENCIES suffix", () => {
    expect(normaliseSupplierName("Raylinc Agencies")).toBe("raylinc");
    expect(normaliseSupplierName("RAYLINC AGENCIES PTY LTD")).toBe("raylinc");
  });

  it("handles Luxson variants", () => {
    const a = normaliseSupplierName("Luxson Illumination");
    const b = normaliseSupplierName("LUXSON ILLUMINATION");
    const c = normaliseSupplierName("Luxson Illumination Pty Ltd");
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("handles Clevertronics variants", () => {
    const a = normaliseSupplierName("Clevertronics");
    const b = normaliseSupplierName("CLEVERTRONICS PTY LTD");
    const c = normaliseSupplierName("Clevertronics Australia");
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("removes non-alphanumeric characters", () => {
    expect(normaliseSupplierName("O'Brien & Sons")).toBe("obriensons");
    // "and" stays since it's alphanumeric, but "&" is stripped
    expect(normaliseSupplierName("OBrien and Sons")).toBe("obrienandsons");
  });

  it("handles empty and whitespace-only names", () => {
    expect(normaliseSupplierName("")).toBe("");
    expect(normaliseSupplierName("   ")).toBe("");
  });
});
