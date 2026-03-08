import { describe, expect, it } from "vitest";

/**
 * Tests for the customer schedule type code normalisation and matching logic.
 * These mirror the normaliseTypeCode and findFuzzyMatch functions in the frontend.
 */

// Replicate the normaliseTypeCode function from the frontend
function normaliseTypeCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/^TYPE\s+/i, "")
    .replace(/^LUMINAIRE\s+/i, "")
    .replace(/^FIXTURE\s+/i, "")
    .replace(/^FTG\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Replicate the findFuzzyMatch function from the frontend
function findFuzzyMatch(
  normType: string,
  schedulePriority: Map<string, number>
): number | undefined {
  if (!normType) return undefined;
  for (const [schedCode, priority] of Array.from(schedulePriority.entries())) {
    if (normType.includes(schedCode) || schedCode.includes(normType)) {
      return priority;
    }
    const stripped = normType.replace(/[\s\-\/]+/g, "");
    const schedStripped = schedCode.replace(/[\s\-\/]+/g, "");
    if (
      stripped === schedStripped ||
      stripped.includes(schedStripped) ||
      schedStripped.includes(stripped)
    ) {
      return priority;
    }
  }
  return undefined;
}

describe("Customer Schedule - Type Code Normalisation", () => {
  it("strips TYPE prefix from codes", () => {
    expect(normaliseTypeCode("TYPE 1L")).toBe("1L");
    expect(normaliseTypeCode("Type 1P")).toBe("1P");
    expect(normaliseTypeCode("type 2S")).toBe("2S");
    expect(normaliseTypeCode("TYPE LED 1")).toBe("LED 1");
    expect(normaliseTypeCode("TYPE W2")).toBe("W2");
  });

  it("strips LUMINAIRE and FIXTURE prefixes", () => {
    expect(normaliseTypeCode("LUMINAIRE 1L")).toBe("1L");
    expect(normaliseTypeCode("Fixture D7")).toBe("D7");
    expect(normaliseTypeCode("FTG 3E")).toBe("3E");
  });

  it("normalises whitespace", () => {
    expect(normaliseTypeCode("TYPE   LED   2")).toBe("LED 2");
    expect(normaliseTypeCode("  1L  ")).toBe("1L");
  });

  it("uppercases codes", () => {
    expect(normaliseTypeCode("led 1")).toBe("LED 1");
    expect(normaliseTypeCode("pl1")).toBe("PL1");
  });

  it("handles codes without prefix", () => {
    expect(normaliseTypeCode("1L")).toBe("1L");
    expect(normaliseTypeCode("D7")).toBe("D7");
    expect(normaliseTypeCode("FREIGHT")).toBe("FREIGHT");
    expect(normaliseTypeCode("PL1")).toBe("PL1");
  });
});

describe("Customer Schedule - Fuzzy Matching", () => {
  const schedulePriority = new Map<string, number>([
    ["1L", 0],
    ["1P", 1],
    ["2S", 2],
    ["LED 1", 3],
    ["LED 2", 4],
    ["D7", 5],
    ["W2", 6],
    ["FREIGHT", 7],
  ]);

  it("matches exact normalised codes", () => {
    expect(findFuzzyMatch("1L", schedulePriority)).toBe(0);
    expect(findFuzzyMatch("LED 1", schedulePriority)).toBe(3);
    expect(findFuzzyMatch("FREIGHT", schedulePriority)).toBe(7);
  });

  it("matches when item type contains schedule code", () => {
    // e.g. item type "1L-SPECIAL" should match schedule code "1L"
    expect(findFuzzyMatch("1L-SPECIAL", schedulePriority)).toBe(0);
  });

  it("matches when schedule code contains item type", () => {
    // e.g. schedule has "LED 1" and item has "LED1" (no space)
    expect(findFuzzyMatch("LED1", schedulePriority)).toBe(3);
  });

  it("matches with stripped whitespace and hyphens", () => {
    expect(findFuzzyMatch("LED-1", schedulePriority)).toBe(3);
    expect(findFuzzyMatch("LED/1", schedulePriority)).toBe(3);
  });

  it("returns undefined for unmatched types", () => {
    expect(findFuzzyMatch("UNKNOWN", schedulePriority)).toBeUndefined();
    expect(findFuzzyMatch("XYZ", schedulePriority)).toBeUndefined();
  });

  it("returns undefined for empty type", () => {
    expect(findFuzzyMatch("", schedulePriority)).toBeUndefined();
  });
});

describe("Customer Schedule - Auto-Sort Logic", () => {
  // Simulate the sorting logic from the frontend
  function autoSort(
    items: { id: number; type: string }[],
    schedule: { code: string }[]
  ): number[] {
    const schedulePriority = new Map<string, number>();
    schedule.forEach((t, idx) => {
      const norm = normaliseTypeCode(t.code);
      if (!schedulePriority.has(norm)) {
        schedulePriority.set(norm, idx);
      }
    });

    const entries = items.map((item) => {
      const normType = normaliseTypeCode(item.type);
      return { id: item.id, normType };
    });

    entries.sort((a, b) => {
      const aPriority = schedulePriority.get(a.normType);
      const bPriority = schedulePriority.get(b.normType);
      const aMatch =
        aPriority !== undefined
          ? aPriority
          : findFuzzyMatch(a.normType, schedulePriority);
      const bMatch =
        bPriority !== undefined
          ? bPriority
          : findFuzzyMatch(b.normType, schedulePriority);

      if (aMatch !== undefined && bMatch !== undefined) return aMatch - bMatch;
      if (aMatch !== undefined) return -1;
      if (bMatch !== undefined) return 1;
      return 0;
    });

    return entries.map((e) => e.id);
  }

  it("sorts items to match customer schedule order", () => {
    const items = [
      { id: 1, type: "2S" },
      { id: 2, type: "1L" },
      { id: 3, type: "1P" },
      { id: 4, type: "LED 1" },
    ];
    const schedule = [
      { code: "1L" },
      { code: "1P" },
      { code: "2S" },
      { code: "LED 1" },
    ];

    const result = autoSort(items, schedule);
    expect(result).toEqual([2, 3, 1, 4]); // 1L, 1P, 2S, LED 1
  });

  it("puts unmatched items at the end", () => {
    const items = [
      { id: 1, type: "UNKNOWN" },
      { id: 2, type: "1L" },
      { id: 3, type: "1P" },
    ];
    const schedule = [{ code: "1L" }, { code: "1P" }];

    const result = autoSort(items, schedule);
    expect(result).toEqual([2, 3, 1]); // matched first, then unmatched
  });

  it("handles TYPE prefix in schedule codes", () => {
    const items = [
      { id: 1, type: "W2" },
      { id: 2, type: "LED 2" },
      { id: 3, type: "1L" },
    ];
    const schedule = [
      { code: "TYPE 1L" },
      { code: "TYPE LED 2" },
      { code: "TYPE W2" },
    ];

    const result = autoSort(items, schedule);
    expect(result).toEqual([3, 2, 1]); // 1L, LED 2, W2
  });

  it("handles multiple items of the same type", () => {
    const items = [
      { id: 1, type: "2S" },
      { id: 2, type: "1L" },
      { id: 3, type: "1L" }, // second 1L item (different supplier)
      { id: 4, type: "2S" }, // second 2S item
    ];
    const schedule = [{ code: "1L" }, { code: "2S" }];

    const result = autoSort(items, schedule);
    // Both 1L items should come before both 2S items
    expect(result[0]).toBe(2); // first 1L
    expect(result[1]).toBe(3); // second 1L
    expect(result[2]).toBe(1); // first 2S
    expect(result[3]).toBe(4); // second 2S
  });

  it("handles FREIGHT at the end of schedule", () => {
    const items = [
      { id: 1, type: "FREIGHT" },
      { id: 2, type: "1L" },
      { id: 3, type: "2S" },
    ];
    const schedule = [
      { code: "1L" },
      { code: "2S" },
      { code: "FREIGHT" },
    ];

    const result = autoSort(items, schedule);
    expect(result).toEqual([2, 3, 1]); // 1L, 2S, FREIGHT
  });
});
