import { describe, expect, it, vi, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Track IDs for cleanup
const testCreatedIds = {
  projects: [] as number[],
  supplierQuotes: [] as number[],
  suppliers: [] as number[],
  customerQuotes: [] as number[],
};

function createAuthContext(userId: number = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-discount-${userId}`,
    email: "test@mmalbion.com.au",
    name: "Test Discount User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

afterAll(async () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  for (const cqId of testCreatedIds.customerQuotes) {
    try { await caller.customerQuotes.delete({ id: cqId }); } catch {}
  }
  for (const sqId of testCreatedIds.supplierQuotes) {
    try { await caller.supplierQuotes.delete({ id: sqId }); } catch {}
  }
  for (const pId of testCreatedIds.projects) {
    try { await caller.projects.delete({ id: pId }); } catch {}
  }
  for (const sId of testCreatedIds.suppliers) {
    try { await caller.suppliers.delete({ id: sId }); } catch {}
    try { await caller.suppliers.archive({ id: sId }); } catch {}
  }
});

// =====================================================================
// Unit tests for discount pricing formula (no DB needed)
// =====================================================================
describe("Discount Pricing Formula", () => {
  // Formula: discountedCost = cost * (1 - discount/100)
  //          sellPrice = discountedCost / (1 - margin/100)
  const calcSellPrice = (cost: number, discount: number, margin: number): number => {
    const discountedCost = cost * (1 - discount / 100);
    return margin >= 100 ? discountedCost : discountedCost / (1 - margin / 100);
  };

  it("applies 10% discount before 20% margin", () => {
    // Cost $100, 10% discount → $90, 20% margin → $90 / 0.80 = $112.50
    const sell = calcSellPrice(100, 10, 20);
    expect(sell).toBeCloseTo(112.50, 2);
  });

  it("applies 15% discount before 25% margin", () => {
    // Cost $200, 15% discount → $170, 25% margin → $170 / 0.75 = $226.67
    const sell = calcSellPrice(200, 15, 25);
    expect(sell).toBeCloseTo(226.67, 2);
  });

  it("applies 0% discount (no change)", () => {
    // Cost $100, 0% discount → $100, 20% margin → $100 / 0.80 = $125
    const sell = calcSellPrice(100, 0, 20);
    expect(sell).toBeCloseTo(125, 2);
  });

  it("applies 100% discount (free)", () => {
    // Cost $100, 100% discount → $0, 20% margin → $0 / 0.80 = $0
    const sell = calcSellPrice(100, 100, 20);
    expect(sell).toBeCloseTo(0, 2);
  });

  it("applies discount with 0% margin (sell at discounted cost)", () => {
    // Cost $100, 10% discount → $90, 0% margin → $90 / 1.0 = $90
    const sell = calcSellPrice(100, 10, 0);
    expect(sell).toBeCloseTo(90, 2);
  });

  it("applies discount with 100% margin (caps at discounted cost)", () => {
    // Cost $100, 10% discount → $90, 100% margin → division by zero guard → $90
    const sell = calcSellPrice(100, 10, 100);
    expect(sell).toBeCloseTo(90, 2);
  });

  it("calculates cable supplier scenario: Prysmian 5% discount, 10% margin", () => {
    // Cost $3.45/m, 5% discount → $3.2775, 10% margin → $3.2775 / 0.90 = $3.6417
    const sell = calcSellPrice(3.45, 5, 10);
    expect(sell).toBeCloseTo(3.6417, 2);
  });

  it("calculates cable supplier scenario: Electra 8% discount, 15% margin", () => {
    // Cost $12.50/m, 8% discount → $11.50, 15% margin → $11.50 / 0.85 = $13.5294
    const sell = calcSellPrice(12.50, 8, 15);
    expect(sell).toBeCloseTo(13.5294, 2);
  });
});

// =====================================================================
// Integration tests: discount persisted to DB via tRPC
// =====================================================================
describe("Discount Persistence via tRPC", () => {
  it("creates customer quote line item with discount and verifies sell price", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a supplier
    const uniqueSupplier = `DiscountTestSupplier-${Date.now()}`;
    await caller.suppliers.create({ name: uniqueSupplier, defaultMarkupPercent: 0 });
    const allSuppliers = await caller.suppliers.list();
    const supplier = allSuppliers.find(s => s.name === uniqueSupplier);
    expect(supplier).toBeDefined();
    if (!supplier) return;
    testCreatedIds.suppliers.push(supplier.id);

    // Create a project
    const uniqueProject = `DiscountTestProject-${Date.now()}`;
    await caller.projects.create({
      name: uniqueProject,
      customerName: "Cable Test Customer",
    });
    const projects = await caller.projects.list();
    const project = projects.find(p => p.name === uniqueProject);
    expect(project).toBeDefined();
    if (!project) return;
    testCreatedIds.projects.push(project.id);

    // Create a supplier quote
    const quoteNum = `SQ-DISC-${Date.now()}`;
    await caller.supplierQuotes.create({
      projectId: project.id,
      supplierId: supplier.id,
      quoteNumber: quoteNum,
    });
    const sqs = await caller.supplierQuotes.getByProject({ projectId: project.id });
    const sq = sqs.find(s => s.quoteNumber === quoteNum);
    expect(sq).toBeDefined();
    if (!sq) return;
    testCreatedIds.supplierQuotes.push(sq.id);

    // Create a line item (cable at $10/m)
    await caller.lineItems.create({
      supplierQuoteId: sq.id,
      itemNumber: 1,
      type: "CABLE",
      productCode: "TPS-2.5",
      description: "2.5mm TPS Cable",
      quantity: 100,
      costPrice: "10.00",
      unitOfMeasure: "M",
    });

    const items = await caller.lineItems.getBySupplierQuote({ supplierQuoteId: sq.id });
    expect(items.length).toBe(1);
    const lineItem = items[0];

    // Create a customer quote
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + 28);
    await caller.customerQuotes.create({
      projectId: project.id,
      quoteNumber: `CQ-DISC-${Date.now()}`,
      versionNumber: 0,
      jobTitle: "Discount Test Quote",
      globalMarkupPercent: 20,
      validToDate: validTo,
    });

    const cqs = await caller.customerQuotes.getByProject({ projectId: project.id });
    const cq = cqs[cqs.length - 1];
    testCreatedIds.customerQuotes.push(cq.id);

    // Create line item WITH 10% discount and 20% margin
    await caller.customerQuoteLineItems.create({
      customerQuoteId: cq.id,
      lineItemId: lineItem.id,
      quantity: 100,
      description: "2.5mm TPS Cable",
      costPrice: "10.00",
      markupPercent: 20,
      discountPercent: 10,
      lineOrder: 1,
      itemType: "CABLE",
    });

    // Verify: discountedCost = 10 * (1 - 0.10) = 9, sellPrice = 9 / (1 - 0.20) = 11.25
    const cqItems = await caller.customerQuoteLineItems.getByCustomerQuote({
      customerQuoteId: cq.id,
    });
    expect(cqItems.length).toBe(1);
    const cqItem = cqItems[0];
    expect(cqItem.discountPercent).toBe(10);
    expect(parseFloat(cqItem.sellPrice)).toBeCloseTo(11.25, 2);
  });

  it("creates line item with 0% discount (no change from standard margin)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (testCreatedIds.customerQuotes.length === 0 || testCreatedIds.supplierQuotes.length === 0) {
      console.warn("Skipping: no test data available");
      return;
    }

    const sqId = testCreatedIds.supplierQuotes[0];
    const items = await caller.lineItems.getBySupplierQuote({ supplierQuoteId: sqId });
    if (items.length === 0) return;

    const cqId = testCreatedIds.customerQuotes[0];
    const lineItem = items[0];

    // Create line item with 0% discount and 20% margin
    await caller.customerQuoteLineItems.create({
      customerQuoteId: cqId,
      lineItemId: lineItem.id,
      quantity: 50,
      description: "No discount cable",
      costPrice: "10.00",
      markupPercent: 20,
      discountPercent: 0,
      lineOrder: 2,
      itemType: "CABLE",
    });

    const cqItems = await caller.customerQuoteLineItems.getByCustomerQuote({
      customerQuoteId: cqId,
    });
    const noDiscItem = cqItems.find(i => i.lineOrder === 2);
    expect(noDiscItem).toBeDefined();
    if (noDiscItem) {
      expect(noDiscItem.discountPercent).toBe(0);
      // sellPrice = 10 / (1 - 0.20) = 12.50
      expect(parseFloat(noDiscItem.sellPrice)).toBeCloseTo(12.50, 2);
    }
  });

  it("creates line item without specifying discount (defaults to 0)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (testCreatedIds.customerQuotes.length === 0 || testCreatedIds.supplierQuotes.length === 0) {
      console.warn("Skipping: no test data available");
      return;
    }

    const sqId = testCreatedIds.supplierQuotes[0];
    const items = await caller.lineItems.getBySupplierQuote({ supplierQuoteId: sqId });
    if (items.length === 0) return;

    const cqId = testCreatedIds.customerQuotes[0];
    const lineItem = items[0];

    // Create line item WITHOUT specifying discountPercent
    await caller.customerQuoteLineItems.create({
      customerQuoteId: cqId,
      lineItemId: lineItem.id,
      quantity: 25,
      description: "Default discount cable",
      costPrice: "10.00",
      markupPercent: 20,
      lineOrder: 3,
      itemType: "CABLE",
    });

    const cqItems = await caller.customerQuoteLineItems.getByCustomerQuote({
      customerQuoteId: cqId,
    });
    const defaultItem = cqItems.find(i => i.lineOrder === 3);
    expect(defaultItem).toBeDefined();
    if (defaultItem) {
      expect(defaultItem.discountPercent).toBe(0);
      // sellPrice = 10 / (1 - 0.20) = 12.50
      expect(parseFloat(defaultItem.sellPrice)).toBeCloseTo(12.50, 2);
    }
  });
});
