/**
 * Cable Unit Normalization
 *
 * Cable suppliers (Prysmian, Electra) quote in various units (KM, 500M, 100M, M, EA).
 * We normalize all cable pricing to per 100m for consistent quoting.
 *
 * IMPORTANT: This conversion ONLY applies to cable suppliers.
 * Other suppliers (e.g., Lightcore, Lumen8) may use "metres" for LED strip pricing
 * which should NOT be converted to per-100m.
 *
 * Conversion factors (multiply costPrice by this to get per-100m price):
 *   KM   → ÷ 10  (factor = 0.1)
 *   500M → ÷ 5   (factor = 0.2)
 *   M    → × 100 (factor = 100)
 *   100M → × 1   (factor = 1, already correct)
 *   EA   → no conversion (not length-based)
 */

/** Known cable suppliers whose per-metre/per-km pricing should be normalized to per 100m */
const CABLE_SUPPLIER_NAMES = [
  "prysmian",
  "electra",
  "electra cables",
  "prysmian group",
  "prysmian australia",
];

/** Units that represent cable lengths and should be normalized (only for cable suppliers) */
const CABLE_LENGTH_UNITS: Record<string, number> = {
  KM: 0.1,           // 1 KM = 10 × 100m → price per 100m = price per KM / 10
  km: 0.1,
  "500M": 0.2,       // 1 × 500M = 5 × 100m → price per 100m = price per 500M / 5
  "500m": 0.2,
  M: 100,            // 100 × 1M = 1 × 100m → price per 100m = price per M × 100
  m: 100,
  "Per Meter": 100,  // same as M
  "metres": 100,     // same as M
  "100M": 1,         // already per 100m
  "100m": 1,
};

/** Non-length units that should NOT be converted */
const NON_LENGTH_UNITS = [
  "EA", "ea", "Each", "each", "Unit", "unit", "UNIT",
  "Pce", "pce", "LOT", "lot", "SET", "set",
  "AUD", "Per Delivery", "Total Delivery Fee", "F.I.S.",
];

export interface UnitConversionResult {
  /** The cost price normalized to per 100m */
  costPricePer100m: number;
  /** The original cost price from the supplier */
  originalCostPrice: number;
  /** The original unit of measure */
  originalUnit: string;
  /** Whether conversion was applied */
  wasConverted: boolean;
  /** The display unit after conversion */
  displayUnit: string;
  /** Conversion factor that was applied (originalCost × factor = per100mCost) */
  conversionFactor: number;
}

/**
 * Check if a supplier is a cable supplier whose pricing should be normalized.
 */
export function isCableSupplier(supplierName: string | null | undefined): boolean {
  if (!supplierName) return false;
  const lower = supplierName.toLowerCase().trim();
  return CABLE_SUPPLIER_NAMES.some(
    (name) => lower.includes(name) || name.includes(lower)
  );
}

/**
 * Check if a unit of measure represents a cable length measurement
 */
export function isCableLengthUnit(unitOfMeasure: string | null | undefined): boolean {
  if (!unitOfMeasure) return false;
  return unitOfMeasure in CABLE_LENGTH_UNITS;
}

/**
 * Check if a unit of measure is a non-length unit (EA, Unit, etc.)
 */
export function isNonLengthUnit(unitOfMeasure: string | null | undefined): boolean {
  if (!unitOfMeasure) return true; // default to non-length if unknown
  return NON_LENGTH_UNITS.includes(unitOfMeasure);
}

/**
 * Get the conversion factor to normalize a unit to per 100m.
 * Returns null if the unit is not a cable length unit.
 */
export function getConversionFactor(unitOfMeasure: string | null | undefined): number | null {
  if (!unitOfMeasure) return null;
  return CABLE_LENGTH_UNITS[unitOfMeasure] ?? null;
}

/**
 * Convert a supplier cost price to per-100m pricing.
 * 
 * IMPORTANT: Only converts pricing for cable suppliers (Prysmian, Electra).
 * Non-cable suppliers (Lightcore, Lumen8, etc.) keep their original pricing
 * even if they use per-metre units (e.g., LED strip sold per metre).
 *
 * @param costPrice - The supplier's quoted price per their unit
 * @param unitOfMeasure - The supplier's unit of measure (KM, 500M, M, 100M, EA, etc.)
 * @param supplierName - The supplier's name (used to determine if cable conversion applies)
 * @returns Conversion result with normalized price, or original price if no conversion needed
 */
export function normalizeToPer100m(
  costPrice: number,
  unitOfMeasure: string | null | undefined,
  supplierName?: string | null
): UnitConversionResult {
  const unit = unitOfMeasure || "EA";
  const factor = CABLE_LENGTH_UNITS[unit];

  // Only apply conversion if this is a cable supplier
  const cableSupplier = isCableSupplier(supplierName);

  if (cableSupplier && factor !== undefined && factor !== 1) {
    return {
      costPricePer100m: costPrice * factor,
      originalCostPrice: costPrice,
      originalUnit: unit,
      wasConverted: true,
      displayUnit: "100M",
      conversionFactor: factor,
    };
  }

  return {
    costPricePer100m: costPrice,
    originalCostPrice: costPrice,
    originalUnit: unit,
    wasConverted: false,
    displayUnit: unit === "100M" || unit === "100m" ? "100M" : unit,
    conversionFactor: 1,
  };
}

/**
 * Convert a quantity from per-100m back to the supplier's original unit.
 * Useful when placing orders with suppliers in their native units.
 *
 * @param quantityPer100m - Quantity in 100m units
 * @param originalUnit - The supplier's original unit of measure
 * @returns Quantity in the supplier's original unit
 */
export function convertQuantityToOriginalUnit(
  quantityPer100m: number,
  originalUnit: string
): number {
  const factor = CABLE_LENGTH_UNITS[originalUnit];
  if (factor !== undefined && factor !== 1) {
    // Reverse the conversion: if KM factor is 0.1, then 10 × 100m = 1 KM
    return quantityPer100m * factor;
  }
  return quantityPer100m;
}

/**
 * Format a unit conversion note for display.
 * E.g., "Originally $2,783.90/KM → $278.39/100M"
 */
export function formatConversionNote(result: UnitConversionResult): string | null {
  if (!result.wasConverted) return null;
  return `Originally $${result.originalCostPrice.toFixed(2)}/${result.originalUnit} → $${result.costPricePer100m.toFixed(2)}/100M`;
}
