import { describe, it, expect } from "vitest";
import {
  normalizeToPer100m,
  isCableLengthUnit,
  isNonLengthUnit,
  getConversionFactor,
  convertQuantityToOriginalUnit,
  formatConversionNote,
  isCableSupplier,
} from "../shared/cableUnits";

describe("Cable Unit Normalization", () => {
  describe("isCableSupplier", () => {
    it("identifies Prysmian as a cable supplier", () => {
      expect(isCableSupplier("Prysmian")).toBe(true);
      expect(isCableSupplier("Prysmian Group")).toBe(true);
      expect(isCableSupplier("Prysmian Australia")).toBe(true);
      expect(isCableSupplier("PRYSMIAN")).toBe(true);
    });

    it("identifies Electra as a cable supplier", () => {
      expect(isCableSupplier("Electra")).toBe(true);
      expect(isCableSupplier("Electra Cables")).toBe(true);
      expect(isCableSupplier("ELECTRA")).toBe(true);
    });

    it("returns false for non-cable suppliers", () => {
      expect(isCableSupplier("Lightcore")).toBe(false);
      expect(isCableSupplier("Lumen8")).toBe(false);
      expect(isCableSupplier("Everlite Lighting Group")).toBe(false);
      expect(isCableSupplier("Clevertronics")).toBe(false);
      expect(isCableSupplier("Smartscape")).toBe(false);
      expect(isCableSupplier("Raylinc")).toBe(false);
      expect(isCableSupplier("LIGHTING COLLECTIVE LUXURY LIGHTING")).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(isCableSupplier(null)).toBe(false);
      expect(isCableSupplier(undefined)).toBe(false);
      expect(isCableSupplier("")).toBe(false);
    });
  });

  describe("isCableLengthUnit", () => {
    it("identifies KM as a cable length unit", () => {
      expect(isCableLengthUnit("KM")).toBe(true);
    });

    it("identifies M as a cable length unit", () => {
      expect(isCableLengthUnit("M")).toBe(true);
      expect(isCableLengthUnit("m")).toBe(true);
    });

    it("identifies 500M as a cable length unit", () => {
      expect(isCableLengthUnit("500M")).toBe(true);
      expect(isCableLengthUnit("500m")).toBe(true);
    });

    it("identifies 100M as a cable length unit", () => {
      expect(isCableLengthUnit("100M")).toBe(true);
      expect(isCableLengthUnit("100m")).toBe(true);
    });

    it("identifies Per Meter and metres as cable length units", () => {
      expect(isCableLengthUnit("Per Meter")).toBe(true);
      expect(isCableLengthUnit("metres")).toBe(true);
    });

    it("returns false for non-length units", () => {
      expect(isCableLengthUnit("EA")).toBe(false);
      expect(isCableLengthUnit("Pce")).toBe(false);
      expect(isCableLengthUnit("Unit")).toBe(false);
      expect(isCableLengthUnit(null)).toBe(false);
      expect(isCableLengthUnit(undefined)).toBe(false);
    });
  });

  describe("isNonLengthUnit", () => {
    it("identifies EA, Pce, Unit as non-length units", () => {
      expect(isNonLengthUnit("EA")).toBe(true);
      expect(isNonLengthUnit("Pce")).toBe(true);
      expect(isNonLengthUnit("Unit")).toBe(true);
      expect(isNonLengthUnit("Each")).toBe(true);
    });

    it("identifies delivery/special units as non-length", () => {
      expect(isNonLengthUnit("Per Delivery")).toBe(true);
      expect(isNonLengthUnit("Total Delivery Fee")).toBe(true);
      expect(isNonLengthUnit("AUD")).toBe(true);
      expect(isNonLengthUnit("F.I.S.")).toBe(true);
    });

    it("returns true for null/undefined (default to non-length)", () => {
      expect(isNonLengthUnit(null)).toBe(true);
      expect(isNonLengthUnit(undefined)).toBe(true);
    });

    it("returns false for cable length units", () => {
      expect(isNonLengthUnit("KM")).toBe(false);
      expect(isNonLengthUnit("M")).toBe(false);
      expect(isNonLengthUnit("100M")).toBe(false);
    });
  });

  describe("getConversionFactor", () => {
    it("returns 0.1 for KM (divide by 10)", () => {
      expect(getConversionFactor("KM")).toBe(0.1);
    });

    it("returns 0.2 for 500M (divide by 5)", () => {
      expect(getConversionFactor("500M")).toBe(0.2);
      expect(getConversionFactor("500m")).toBe(0.2);
    });

    it("returns 100 for M (multiply by 100)", () => {
      expect(getConversionFactor("M")).toBe(100);
      expect(getConversionFactor("m")).toBe(100);
      expect(getConversionFactor("Per Meter")).toBe(100);
      expect(getConversionFactor("metres")).toBe(100);
    });

    it("returns 1 for 100M (already correct)", () => {
      expect(getConversionFactor("100M")).toBe(1);
      expect(getConversionFactor("100m")).toBe(1);
    });

    it("returns null for non-length units", () => {
      expect(getConversionFactor("EA")).toBeNull();
      expect(getConversionFactor("Pce")).toBeNull();
      expect(getConversionFactor(null)).toBeNull();
    });
  });

  describe("normalizeToPer100m — cable supplier conversion", () => {
    it("converts KM pricing for Electra (cable supplier)", () => {
      // Electra: $2783.90/KM → $278.39/100M
      const result = normalizeToPer100m(2783.90, "KM", "Electra Cables");
      expect(result.costPricePer100m).toBeCloseTo(278.39, 2);
      expect(result.wasConverted).toBe(true);
      expect(result.displayUnit).toBe("100M");
      expect(result.originalUnit).toBe("KM");
      expect(result.conversionFactor).toBe(0.1);
    });

    it("converts 500M pricing for Electra (cable supplier)", () => {
      // Electra: $1391.95/500M → $278.39/100M
      const result = normalizeToPer100m(1391.95, "500M", "Electra");
      expect(result.costPricePer100m).toBeCloseTo(278.39, 2);
      expect(result.wasConverted).toBe(true);
      expect(result.displayUnit).toBe("100M");
    });

    it("converts per-metre pricing for Prysmian (cable supplier)", () => {
      // Prysmian: $28.21/M → $2821.00/100M
      const result = normalizeToPer100m(28.21, "M", "Prysmian");
      expect(result.costPricePer100m).toBeCloseTo(2821.00, 2);
      expect(result.wasConverted).toBe(true);
      expect(result.displayUnit).toBe("100M");
      expect(result.conversionFactor).toBe(100);
    });

    it("does not convert 100M items for cable suppliers (already correct)", () => {
      const result = normalizeToPer100m(184.50, "100M", "Electra");
      expect(result.costPricePer100m).toBeCloseTo(184.50, 2);
      expect(result.wasConverted).toBe(false);
      expect(result.displayUnit).toBe("100M");
    });

    it("does not convert EA items for cable suppliers", () => {
      const result = normalizeToPer100m(45.00, "EA", "Electra");
      expect(result.costPricePer100m).toBeCloseTo(45.00, 2);
      expect(result.wasConverted).toBe(false);
      expect(result.displayUnit).toBe("EA");
    });

    // Real-world Electra data validation
    it("correctly converts Electra XLPE2160E-BORE: $11629.80/KM → $1162.98/100M", () => {
      const result = normalizeToPer100m(11629.80, "KM", "Electra Cables");
      expect(result.costPricePer100m).toBeCloseTo(1162.98, 2);
    });

    it("correctly converts Electra XLPE2100E-BORE: $8046.40/KM → $804.64/100M", () => {
      const result = normalizeToPer100m(8046.40, "KM", "Electra");
      expect(result.costPricePer100m).toBeCloseTo(804.64, 2);
    });

    // Real-world Prysmian data validation
    it("correctly converts Prysmian 95mm XLPE: $28.21/M → $2821.00/100M", () => {
      const result = normalizeToPer100m(28.21, "M", "Prysmian Group");
      expect(result.costPricePer100m).toBeCloseTo(2821.00, 2);
    });

    it("correctly converts Prysmian 2.5mm flat: $3.50/M → $350.00/100M", () => {
      const result = normalizeToPer100m(3.50, "M", "Prysmian Australia");
      expect(result.costPricePer100m).toBeCloseTo(350.00, 2);
    });
  });

  describe("normalizeToPer100m — NON-cable supplier (no conversion)", () => {
    it("does NOT convert Lightcore LED strip priced per metre", () => {
      // Lightcore: $22.99/metre for LED strip — should NOT be converted
      const result = normalizeToPer100m(22.99, "metres", "Lightcore");
      expect(result.costPricePer100m).toBeCloseTo(22.99, 2);
      expect(result.wasConverted).toBe(false);
      expect(result.displayUnit).toBe("metres");
    });

    it("does NOT convert Lightcore GloPro Neon priced per metre", () => {
      // Lightcore: $59.99/metre for GloPro Neon — should NOT be converted
      const result = normalizeToPer100m(59.99, "metres", "Lightcore");
      expect(result.costPricePer100m).toBeCloseTo(59.99, 2);
      expect(result.wasConverted).toBe(false);
      expect(result.displayUnit).toBe("metres");
    });

    it("does NOT convert Lumen8 items priced per metre", () => {
      const result = normalizeToPer100m(15.50, "M", "Lumen8");
      expect(result.costPricePer100m).toBeCloseTo(15.50, 2);
      expect(result.wasConverted).toBe(false);
      expect(result.displayUnit).toBe("M");
    });

    it("does NOT convert Everlite items priced per metre", () => {
      const result = normalizeToPer100m(8.75, "metres", "Everlite Lighting Group");
      expect(result.costPricePer100m).toBeCloseTo(8.75, 2);
      expect(result.wasConverted).toBe(false);
      expect(result.displayUnit).toBe("metres");
    });

    it("does NOT convert Smartscape items priced per metre", () => {
      const result = normalizeToPer100m(42.00, "M", "Smartscape");
      expect(result.costPricePer100m).toBeCloseTo(42.00, 2);
      expect(result.wasConverted).toBe(false);
    });

    it("does NOT convert Raylinc items priced per metre", () => {
      const result = normalizeToPer100m(12.00, "m", "Raylinc");
      expect(result.costPricePer100m).toBeCloseTo(12.00, 2);
      expect(result.wasConverted).toBe(false);
    });

    it("does NOT convert LIGHTING COLLECTIVE items", () => {
      const result = normalizeToPer100m(35.00, "metres", "LIGHTING COLLECTIVE LUXURY LIGHTING");
      expect(result.costPricePer100m).toBeCloseTo(35.00, 2);
      expect(result.wasConverted).toBe(false);
    });
  });

  describe("normalizeToPer100m — no supplier name provided", () => {
    it("does NOT convert when supplier name is null", () => {
      const result = normalizeToPer100m(22.99, "metres", null);
      expect(result.costPricePer100m).toBeCloseTo(22.99, 2);
      expect(result.wasConverted).toBe(false);
    });

    it("does NOT convert when supplier name is undefined", () => {
      const result = normalizeToPer100m(28.21, "M", undefined);
      expect(result.costPricePer100m).toBeCloseTo(28.21, 2);
      expect(result.wasConverted).toBe(false);
    });

    it("does NOT convert when supplier name is omitted (backward compat)", () => {
      const result = normalizeToPer100m(28.21, "M");
      expect(result.costPricePer100m).toBeCloseTo(28.21, 2);
      expect(result.wasConverted).toBe(false);
    });
  });

  describe("normalizeToPer100m — EA and null units (all suppliers)", () => {
    it("does not convert EA items regardless of supplier", () => {
      const result = normalizeToPer100m(45.00, "EA", "Electra");
      expect(result.costPricePer100m).toBeCloseTo(45.00, 2);
      expect(result.wasConverted).toBe(false);
      expect(result.displayUnit).toBe("EA");
    });

    it("does not convert null/undefined unit (defaults to EA)", () => {
      const result = normalizeToPer100m(100.00, null, "Prysmian");
      expect(result.costPricePer100m).toBeCloseTo(100.00, 2);
      expect(result.wasConverted).toBe(false);
      expect(result.displayUnit).toBe("EA");
    });
  });

  describe("convertQuantityToOriginalUnit", () => {
    it("converts 100m quantity back to KM", () => {
      // 10 × 100m = 1 KM
      expect(convertQuantityToOriginalUnit(10, "KM")).toBeCloseTo(1, 4);
    });

    it("converts 100m quantity back to 500M", () => {
      // 5 × 100m = 1 × 500M
      expect(convertQuantityToOriginalUnit(5, "500M")).toBeCloseTo(1, 4);
    });

    it("converts 100m quantity back to M", () => {
      // 1 × 100m = 100 × M
      expect(convertQuantityToOriginalUnit(1, "M")).toBeCloseTo(100, 4);
    });

    it("returns same quantity for EA", () => {
      expect(convertQuantityToOriginalUnit(5, "EA")).toBe(5);
    });
  });

  describe("formatConversionNote", () => {
    it("formats a conversion note for KM to 100M", () => {
      const result = normalizeToPer100m(2783.90, "KM", "Electra");
      const note = formatConversionNote(result);
      expect(note).toBe("Originally $2783.90/KM → $278.39/100M");
    });

    it("returns null for non-converted items", () => {
      const result = normalizeToPer100m(45.00, "EA", "Electra");
      const note = formatConversionNote(result);
      expect(note).toBeNull();
    });

    it("returns null for non-cable supplier per-metre items", () => {
      const result = normalizeToPer100m(22.99, "metres", "Lightcore");
      const note = formatConversionNote(result);
      expect(note).toBeNull();
    });
  });
});
