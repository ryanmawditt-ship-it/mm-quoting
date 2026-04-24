import { describe, it, expect } from "vitest";

/**
 * Tests for the lead time line item filter logic.
 * This logic filters out "LEAD TIME" rows from extracted line items
 * and moves them into deliveryNotes instead.
 */

// Replicate the filter logic from apiRoutes.ts for unit testing
function filterLeadTimeItems(lineItems: any[]) {
  const filteredLineItems: any[] = [];
  const leadTimeNotes: string[] = [];
  for (const item of lineItems) {
    const code = (item.productCode || "").toUpperCase().trim();
    const desc = (item.description || "").toUpperCase().trim();
    const isLeadTimeLine =
      code === "LEAD TIME" ||
      code === "LEADTIME" ||
      code.startsWith("LEAD TIME") ||
      (desc.includes("LEAD TIME") && item.unitPrice === 0) ||
      (desc.match(/^APPROXIMATELY \d+-\d+ WEEKS/) && item.unitPrice === 0) ||
      (desc.match(/^\d+-\d+ WEEKS FROM ORDER/) && item.unitPrice === 0);
    if (isLeadTimeLine) {
      leadTimeNotes.push(item.description || code);
    } else {
      filteredLineItems.push(item);
    }
  }
  let deliveryNotes: string | null = null;
  if (leadTimeNotes.length > 0) {
    const leadTimeText = leadTimeNotes.join("; ");
    deliveryNotes = `Lead Time: ${leadTimeText}`;
  }
  return { filteredLineItems, leadTimeNotes, deliveryNotes };
}

describe("Lead Time Line Item Filter", () => {
  it("should filter out items with productCode 'LEAD TIME'", () => {
    const items = [
      { productCode: "L8 PROJ", description: "Suspension Planter Light", unitPrice: 4900, quantity: 2 },
      { productCode: "LEAD TIME", description: "Approximately 12-14 weeks from order, subject to change.", unitPrice: 0, quantity: 1 },
      { productCode: "FREIGHT", description: "Processing & Handling", unitPrice: 750, quantity: 1 },
    ];
    const result = filterLeadTimeItems(items);
    expect(result.filteredLineItems).toHaveLength(2);
    expect(result.filteredLineItems[0].productCode).toBe("L8 PROJ");
    expect(result.filteredLineItems[1].productCode).toBe("FREIGHT");
    expect(result.leadTimeNotes).toHaveLength(1);
    expect(result.deliveryNotes).toContain("12-14 weeks");
  });

  it("should filter out items with productCode 'LEADTIME' (no space)", () => {
    const items = [
      { productCode: "LEADTIME", description: "8-10 weeks from order", unitPrice: 0, quantity: 1 },
    ];
    const result = filterLeadTimeItems(items);
    expect(result.filteredLineItems).toHaveLength(0);
    expect(result.leadTimeNotes).toHaveLength(1);
  });

  it("should filter items where description starts with 'Approximately X-Y weeks'", () => {
    const items = [
      { productCode: "UNKNOWN", description: "Approximately 6-8 weeks from order confirmation", unitPrice: 0, quantity: 1 },
    ];
    const result = filterLeadTimeItems(items);
    expect(result.filteredLineItems).toHaveLength(0);
    expect(result.deliveryNotes).toContain("6-8 weeks");
  });

  it("should NOT filter items that have a non-zero price even if description mentions lead time", () => {
    const items = [
      { productCode: "EXPEDITE", description: "Lead time reduction fee", unitPrice: 500, quantity: 1 },
    ];
    const result = filterLeadTimeItems(items);
    expect(result.filteredLineItems).toHaveLength(1);
    expect(result.filteredLineItems[0].productCode).toBe("EXPEDITE");
    expect(result.leadTimeNotes).toHaveLength(0);
  });

  it("should NOT filter freight items", () => {
    const items = [
      { productCode: "FREIGHT", description: "Freight Processing & Handling", unitPrice: 750, quantity: 1 },
    ];
    const result = filterLeadTimeItems(items);
    expect(result.filteredLineItems).toHaveLength(1);
  });

  it("should NOT filter regular product items", () => {
    const items = [
      { productCode: "AT87500921", description: "Constant Current 20W Driver", unitPrice: 32, quantity: 27 },
      { productCode: "L8BUACBLRD", description: "Black Rod Accessory", unitPrice: 126, quantity: 27 },
      { productCode: "SOMODL09930PRO60L", description: "Solis LED module", unitPrice: 0, quantity: 27 },
    ];
    const result = filterLeadTimeItems(items);
    expect(result.filteredLineItems).toHaveLength(3);
    expect(result.leadTimeNotes).toHaveLength(0);
    expect(result.deliveryNotes).toBeNull();
  });

  it("should handle multiple lead time rows", () => {
    const items = [
      { productCode: "L8 PROJ", description: "Fixture", unitPrice: 1000, quantity: 1 },
      { productCode: "LEAD TIME", description: "12-14 weeks from order", unitPrice: 0, quantity: 1 },
      { productCode: "LEAD TIME IMPORT", description: "Imported items 16-20 weeks", unitPrice: 0, quantity: 1 },
    ];
    const result = filterLeadTimeItems(items);
    expect(result.filteredLineItems).toHaveLength(1);
    expect(result.leadTimeNotes).toHaveLength(2);
    expect(result.deliveryNotes).toContain("12-14 weeks");
    expect(result.deliveryNotes).toContain("16-20 weeks");
  });

  it("should handle case-insensitive productCode matching", () => {
    const items = [
      { productCode: "Lead Time", description: "Approximately 10-12 weeks", unitPrice: 0, quantity: 1 },
    ];
    const result = filterLeadTimeItems(items);
    expect(result.filteredLineItems).toHaveLength(0);
    expect(result.leadTimeNotes).toHaveLength(1);
  });

  it("should handle empty line items array", () => {
    const result = filterLeadTimeItems([]);
    expect(result.filteredLineItems).toHaveLength(0);
    expect(result.leadTimeNotes).toHaveLength(0);
    expect(result.deliveryNotes).toBeNull();
  });

  it("should filter description starting with 'X-Y weeks from order'", () => {
    const items = [
      { productCode: "INFO", description: "8-10 weeks from order placement", unitPrice: 0, quantity: 0 },
    ];
    const result = filterLeadTimeItems(items);
    expect(result.filteredLineItems).toHaveLength(0);
    expect(result.deliveryNotes).toContain("8-10 weeks");
  });
});
