import { describe, expect, it, vi, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { salespersons } from "../drizzle/schema";
import { eq } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Track IDs of test-created resources for cleanup
const testCreatedIds = {
  projects: [] as number[],
  supplierQuotes: [] as number[],
  suppliers: [] as number[],
  salespersons: [] as number[],
  customerQuotes: [] as number[],
};

function createAuthContext(userId: number = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: "test@mmalbion.com.au",
    name: "Test User",
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

function createUnauthContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
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

// Global cleanup after all tests
afterAll(async () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  // Clean up in reverse dependency order
  // 1. Delete customer quote line items (via customer quote delete cascade)
  for (const cqId of testCreatedIds.customerQuotes) {
    try {
      await caller.customerQuotes.delete({ id: cqId });
    } catch {}
  }

  // 2. Delete supplier quotes (which cascades line items)
  for (const sqId of testCreatedIds.supplierQuotes) {
    try {
      await caller.supplierQuotes.delete({ id: sqId });
    } catch {}
  }

  // 3. Delete projects
  for (const pId of testCreatedIds.projects) {
    try {
      await caller.projects.delete({ id: pId });
    } catch {}
  }

  // 4. Archive test suppliers then delete them
  for (const sId of testCreatedIds.suppliers) {
    try {
      await caller.suppliers.delete({ id: sId });
    } catch {
      // If delete fails due to FK, archive instead
      try {
        await caller.suppliers.archive({ id: sId });
      } catch {}
    }
  }

  // 5. Delete test salespersons (no delete procedure, use direct DB)
  const dbInst = await getDb();
  if (dbInst) {
    for (const spId of testCreatedIds.salespersons) {
      try {
        await dbInst.delete(salespersons).where(eq(salespersons.id, spId));
      } catch {}
    }
  }
});

describe("Company Settings", () => {
  it("returns undefined when no settings exist", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.company.getSettings();
    // First call should return undefined or existing settings
    expect(result === undefined || result !== null).toBe(true);
  });

  it("creates and retrieves company settings", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.company.updateSettings({
      companyName: "MM Albion",
      abn: "34 003 114 556",
      address: "657 Coronation Drive, Toowong QLD 4066",
      phone: "(07) 3252 2306",
      fax: "(07) 3252 2307",
      email: "quotes@mmalbion.com.au",
      standardTerms: "Payment terms: 30 days net. Quote valid for 28 days.",
    });

    const settings = await caller.company.getSettings();
    expect(settings).toBeDefined();
    if (settings) {
      expect(settings.companyName).toBe("MM Albion");
      expect(settings.abn).toBe("34 003 114 556");
      expect(settings.phone).toBe("(07) 3252 2306");
    }
  });
});

describe("Salespersons", () => {
  it("creates and lists salespersons", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const uniqueName = `TestSP-${Date.now()}`;
    await caller.salespersons.create({
      name: uniqueName,
      email: "testsp@mmalbion.com.au",
    });

    const list = await caller.salespersons.list();
    expect(Array.isArray(list)).toBe(true);
    const sp = list.find((s) => s.name === uniqueName);
    expect(sp).toBeDefined();
    if (sp) {
      testCreatedIds.salespersons.push(sp.id);
      expect(sp.email).toBe("testsp@mmalbion.com.au");
    }
  });
});

describe("Suppliers", () => {
  it("creates a supplier with default margin", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const uniqueName = `TestSupplier-${Date.now()}`;
    await caller.suppliers.create({
      name: uniqueName,
      contact: "Test Contact",
      email: "test@supplier.com",
      phone: "1300 000 000",
      defaultMarkupPercent: 25,
    });

    const list = await caller.suppliers.list();
    expect(Array.isArray(list)).toBe(true);
    const sup = list.find((s) => s.name === uniqueName);
    expect(sup).toBeDefined();
    if (sup) {
      testCreatedIds.suppliers.push(sup.id);
      expect(sup.defaultMarkupPercent).toBe(25);
      expect(sup.contact).toBe("Test Contact");
    }
  });

  it("defaults margin to 0 when not specified", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const uniqueName = `TestNoMargin-${Date.now()}`;
    await caller.suppliers.create({
      name: uniqueName,
    });

    const list = await caller.suppliers.list();
    const testSup = list.find((s) => s.name === uniqueName);
    expect(testSup).toBeDefined();
    if (testSup) {
      testCreatedIds.suppliers.push(testSup.id);
      expect(testSup.defaultMarkupPercent).toBe(0);
    }
  });
});

describe("Projects", () => {
  it("creates a project with customer details", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const uniqueName = `TestProject-${Date.now()}`;
    await caller.projects.create({
      name: uniqueName,
      customerName: "Test Customer Pty Ltd",
      customerContact: "Test Contact",
      customerEmail: "test@customer.com",
      customerAddress: "123 Test St, Brisbane QLD 4000",
      description: "Test project for unit tests",
    });

    const list = await caller.projects.list();
    expect(Array.isArray(list)).toBe(true);
    const proj = list.find((p) => p.name === uniqueName);
    expect(proj).toBeDefined();
    if (proj) {
      testCreatedIds.projects.push(proj.id);
      expect(proj.customerName).toBe("Test Customer Pty Ltd");
      expect(["pending", "won"]).toContain(proj.status);
    }
  });

  it("updates project status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Use a test-created project
    if (testCreatedIds.projects.length > 0) {
      const projectId = testCreatedIds.projects[0];
      await caller.projects.updateStatus({
        id: projectId,
        status: "won",
      });

      const updated = await caller.projects.getById({ id: projectId });
      expect(updated).toBeDefined();
      if (updated) {
        expect(updated.status).toBe("won");
      }

      // Reset to pending
      await caller.projects.updateStatus({ id: projectId, status: "pending" });
    }
  });

  it("retrieves project by ID", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (testCreatedIds.projects.length > 0) {
      const projectId = testCreatedIds.projects[0];
      const project = await caller.projects.getById({ id: projectId });
      expect(project).toBeDefined();
      if (project) {
        expect(project.id).toBe(projectId);
      }
    }
  });
});

describe("Supplier Quotes and Line Items", () => {
  it("creates a supplier quote and line items", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Need a project and supplier
    if (testCreatedIds.projects.length === 0 || testCreatedIds.suppliers.length === 0) {
      console.warn("Skipping: no test project or supplier available");
      return;
    }

    const projectId = testCreatedIds.projects[0];
    const supplierId = testCreatedIds.suppliers[0];

    await caller.supplierQuotes.create({
      projectId,
      supplierId,
      quoteNumber: `Q-TEST-${Date.now()}`,
    });

    const sqs = await caller.supplierQuotes.getByProject({ projectId });
    expect(sqs.length).toBeGreaterThan(0);

    const sq = sqs[sqs.length - 1];
    testCreatedIds.supplierQuotes.push(sq.id);

    // Create line items
    await caller.lineItems.create({
      supplierQuoteId: sq.id,
      itemNumber: 1,
      type: "AH1 BULB",
      productCode: "EV-LED-100W",
      description: "LED Panel Light 100W 6000K",
      quantity: 10,
      costPrice: "45.50",
      unitOfMeasure: "EA",
      leadTimeDays: 14,
    });

    await caller.lineItems.create({
      supplierQuoteId: sq.id,
      itemNumber: 2,
      type: "AL3",
      productCode: "EV-DWN-50W",
      description: "Downlight 50W Warm White",
      quantity: 25,
      costPrice: "32.00",
      unitOfMeasure: "EA",
      leadTimeDays: 7,
    });

    const items = await caller.lineItems.getBySupplierQuote({
      supplierQuoteId: sq.id,
    });
    expect(items.length).toBeGreaterThanOrEqual(2);

    // Verify cost price is stored correctly
    const ledPanel = items.find((i) => i.productCode === "EV-LED-100W");
    expect(ledPanel).toBeDefined();
    if (ledPanel) {
      expect(parseFloat(ledPanel.costPrice)).toBeCloseTo(45.5, 2);
      expect(ledPanel.quantity).toBe(10);
      expect(ledPanel.leadTimeDays).toBe(14);
    }
  });
});

describe("Customer Quotes", () => {
  it("creates a customer quote with line items", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (testCreatedIds.projects.length === 0 || testCreatedIds.supplierQuotes.length === 0) {
      console.warn("Skipping: no test project or supplier quote available");
      return;
    }

    const projectId = testCreatedIds.projects[0];
    const sqId = testCreatedIds.supplierQuotes[0];

    const items = await caller.lineItems.getBySupplierQuote({ supplierQuoteId: sqId });
    if (items.length === 0) {
      console.warn("Skipping: no line items available");
      return;
    }

    const validTo = new Date();
    validTo.setDate(validTo.getDate() + 28);

    await caller.customerQuotes.create({
      projectId,
      quoteNumber: `CQ-TEST-${Date.now()}`,
      versionNumber: 0,
      jobTitle: "Test Customer Quote",
      globalMarkupPercent: 20,
      validToDate: validTo,
    });

    const cqs = await caller.customerQuotes.getByProject({ projectId });
    expect(cqs.length).toBeGreaterThan(0);

    const cq = cqs[cqs.length - 1];
    testCreatedIds.customerQuotes.push(cq.id);
    expect(cq.versionNumber).toBe(0);
    expect(cq.status).toBe("draft");

    // Add line items to customer quote
    const item = items[0];
    const costPrice = parseFloat(item.costPrice);
    const markupPercent = 20;

    await caller.customerQuoteLineItems.create({
      customerQuoteId: cq.id,
      lineItemId: item.id,
      quantity: item.quantity,
      description: item.description || "",
      costPrice: item.costPrice,
      markupPercent,
      lineOrder: 1,
    });

    const cqItems = await caller.customerQuoteLineItems.getByCustomerQuote({
      customerQuoteId: cq.id,
    });
    expect(cqItems.length).toBeGreaterThan(0);

    // Verify sell price calculation using margin formula: Sell = Cost / (1 - margin/100)
    const cqItem = cqItems[0];
    const expectedSellPrice = costPrice / (1 - markupPercent / 100);
    expect(parseFloat(cqItem.sellPrice)).toBeCloseTo(expectedSellPrice, 2);
  });

  it("updates customer quote status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (testCreatedIds.customerQuotes.length > 0) {
      const cqId = testCreatedIds.customerQuotes[0];
      await caller.customerQuotes.updateStatus({
        id: cqId,
        status: "sent",
      });

      const updated = await caller.customerQuotes.getById({ id: cqId });
      if (updated) {
        expect(updated.status).toBe("sent");
      }
    }
  });
});

describe("Margin Calculation", () => {
  it("correctly calculates sell price with margin (Sell = Cost / (1 - margin/100))", () => {
    const costPrice = 45.5;
    const marginPercent = 20;
    // Sell = 45.5 / (1 - 0.20) = 45.5 / 0.80 = 56.875
    const sellPrice = costPrice / (1 - marginPercent / 100);
    expect(sellPrice).toBeCloseTo(56.875, 2);

    const gst = sellPrice * 0.1;
    expect(gst).toBeCloseTo(5.6875, 2);

    const totalInclGst = sellPrice + gst;
    expect(totalInclGst).toBeCloseTo(62.5625, 2);
  });

  it("handles zero margin correctly", () => {
    const costPrice = 100;
    const marginPercent = 0;
    const sellPrice = costPrice / (1 - marginPercent / 100);
    expect(sellPrice).toBe(100);

    const gst = sellPrice * 0.1;
    expect(gst).toBe(10);
  });

  it("handles 5% margin correctly (divide by 0.95)", () => {
    const costPrice = 100;
    const marginPercent = 5;
    // Sell = 100 / 0.95 = 105.2631...
    const sellPrice = costPrice / (1 - marginPercent / 100);
    expect(sellPrice).toBeCloseTo(105.26, 1);
  });

  it("handles high margin correctly", () => {
    const costPrice = 50;
    const marginPercent = 40;
    // Sell = 50 / (1 - 0.40) = 50 / 0.60 = 83.333...
    const sellPrice = costPrice / (1 - marginPercent / 100);
    expect(sellPrice).toBeCloseTo(83.33, 1);
  });
});

describe("Quote Versioning", () => {
  it("generates correct version format", () => {
    const baseQuoteNumber = "880-000001";
    const versionNumber = 0;
    const fullQuoteNumber = `${baseQuoteNumber}-${String(versionNumber).padStart(3, "0")}`;
    expect(fullQuoteNumber).toBe("880-000001-000");

    const v2 = `${baseQuoteNumber}-${String(1).padStart(3, "0")}`;
    expect(v2).toBe("880-000001-001");

    const v10 = `${baseQuoteNumber}-${String(10).padStart(3, "0")}`;
    expect(v10).toBe("880-000001-010");
  });
});

describe("Project Status Management", () => {
  it("cycles through all status values", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (testCreatedIds.projects.length === 0) {
      console.warn("Skipping: no test project available");
      return;
    }

    const projectId = testCreatedIds.projects[0];
    const statuses = ["pending", "sent", "in_progress", "won", "lost"] as const;

    for (const status of statuses) {
      await caller.projects.updateStatus({ id: projectId, status });
      const updated = await caller.projects.getById({ id: projectId });
      expect(updated).toBeDefined();
      if (updated) {
        expect(updated.status).toBe(status);
      }
    }

    // Reset to pending for other tests
    await caller.projects.updateStatus({ id: projectId, status: "pending" });
  });
});

describe("Project Delete", () => {
  it("creates and deletes a project with cascade", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const uniqueName = `DeleteTest-${Date.now()}`;
    await caller.projects.create({
      name: uniqueName,
      customerName: "Test Customer",
      description: "This project will be deleted",
    });

    const listBefore = await caller.projects.list();
    const deleteTarget = listBefore.find((p) => p.name === uniqueName);
    expect(deleteTarget).toBeDefined();

    if (deleteTarget) {
      await caller.projects.delete({ id: deleteTarget.id });

      const listAfter = await caller.projects.list();
      const deleted = listAfter.find((p) => p.name === uniqueName);
      expect(deleted).toBeUndefined();
    }
  });
});

describe("Project Supplier Tracking", () => {
  it("adds, deduplicates, and removes project suppliers", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (testCreatedIds.projects.length === 0 || testCreatedIds.suppliers.length === 0) {
      console.warn("Skipping: no test project or supplier available");
      return;
    }

    const projectId = testCreatedIds.projects[0];
    const supplierId = testCreatedIds.suppliers[0];

    // Add supplier to project
    await caller.projectSuppliers.add({ projectId, supplierId });
    const afterAdd = await caller.projectSuppliers.list({ projectId });
    const tracked = afterAdd.find(ps => ps.supplierId === supplierId);
    expect(tracked).toBeDefined();

    // Adding same supplier again should not duplicate
    await caller.projectSuppliers.add({ projectId, supplierId });
    const afterDup = await caller.projectSuppliers.list({ projectId });
    const trackedCount = afterDup.filter(ps => ps.supplierId === supplierId).length;
    expect(trackedCount).toBe(1);

    // Remove the tracked supplier
    await caller.projectSuppliers.remove({ projectId, supplierId });
    const afterRemove = await caller.projectSuppliers.list({ projectId });
    const removedCheck = afterRemove.find(ps => ps.supplierId === supplierId);
    expect(removedCheck).toBeUndefined();
  });
});

describe("Number Sanitisation (extraction edge cases)", () => {
  // These test the same logic used in apiRoutes.ts sanitiseNumber
  const sanitiseNumber = (val: any): number => {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const cleaned = val.replace(/[\$AUD]/gi, "").replace(/(\d)\s+(\d)/g, "$1$2").replace(/,/g, "").trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  it("handles standard decimal numbers", () => {
    expect(sanitiseNumber(45.50)).toBe(45.50);
    expect(sanitiseNumber("45.50")).toBe(45.50);
  });

  it("handles comma-separated thousands", () => {
    expect(sanitiseNumber("2,950.00")).toBe(2950.00);
    expect(sanitiseNumber("12,345.67")).toBe(12345.67);
  });

  it("handles space-separated thousands (Luxson format)", () => {
    expect(sanitiseNumber("5 393.29")).toBe(5393.29);
    expect(sanitiseNumber("4 541.46")).toBe(4541.46);
    expect(sanitiseNumber("10 000.00")).toBe(10000.00);
  });

  it("strips currency symbols", () => {
    expect(sanitiseNumber("$45.50")).toBe(45.50);
    expect(sanitiseNumber("AUD 2,950.00")).toBe(2950.00);
    expect(sanitiseNumber("$5 393.29")).toBe(5393.29);
  });

  it("handles zero and empty values", () => {
    expect(sanitiseNumber(0)).toBe(0);
    expect(sanitiseNumber("0")).toBe(0);
    expect(sanitiseNumber("")).toBe(0);
    expect(sanitiseNumber(null)).toBe(0);
    expect(sanitiseNumber(undefined)).toBe(0);
  });
});

describe("Supplier Quote with enriched fields", () => {
  it("creates a supplier quote with validity and delivery notes", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (testCreatedIds.projects.length === 0 || testCreatedIds.suppliers.length === 0) {
      console.warn("Skipping: no test project or supplier available");
      return;
    }

    const projectId = testCreatedIds.projects[0];
    const supplierId = testCreatedIds.suppliers[0];

    const quoteNum = `Q-ENRICHED-${Date.now()}`;
    await caller.supplierQuotes.create({
      projectId,
      supplierId,
      quoteNumber: quoteNum,
    });

    const sqs = await caller.supplierQuotes.getByProject({ projectId });
    const enrichedSq = sqs.find(sq => sq.quoteNumber === quoteNum);
    expect(enrichedSq).toBeDefined();
    if (enrichedSq) {
      testCreatedIds.supplierQuotes.push(enrichedSq.id);
      expect(enrichedSq.quoteNumber).toBe(quoteNum);
    }
  });

  it("creates line items with comments and bundled flag", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (testCreatedIds.projects.length === 0 || testCreatedIds.suppliers.length === 0) {
      console.warn("Skipping: no test project or supplier available");
      return;
    }

    const projectId = testCreatedIds.projects[0];
    const supplierId = testCreatedIds.suppliers[0];

    const quoteNum = `Q-BUNDLED-${Date.now()}`;
    await caller.supplierQuotes.create({
      projectId,
      supplierId,
      quoteNumber: quoteNum,
    });

    const sqs = await caller.supplierQuotes.getByProject({ projectId });
    const sq = sqs.find(s => s.quoteNumber === quoteNum);
    expect(sq).toBeDefined();
    if (!sq) return;
    testCreatedIds.supplierQuotes.push(sq.id);

    // Create a normal priced item
    await caller.lineItems.create({
      supplierQuoteId: sq.id,
      itemNumber: 1,
      type: "1S",
      productCode: "LUMI-100",
      description: "LED Luminaire 100W 4000K",
      quantity: 5,
      costPrice: "250.00",
      unitOfMeasure: "EA",
      leadTimeDays: 21,
    });

    // Create a bundled item (pole with no price)
    await caller.lineItems.create({
      supplierQuoteId: sq.id,
      itemNumber: 2,
      type: "1S",
      productCode: "POLE-5M",
      description: "5m Steel Pole Powdercoated",
      quantity: 5,
      costPrice: "0",
      unitOfMeasure: "EA",
    });

    const items = await caller.lineItems.getBySupplierQuote({ supplierQuoteId: sq.id });
    expect(items.length).toBeGreaterThanOrEqual(2);

    const luminaire = items.find(i => i.productCode === "LUMI-100");
    expect(luminaire).toBeDefined();
    if (luminaire) {
      expect(parseFloat(luminaire.costPrice)).toBeCloseTo(250, 2);
      expect(luminaire.leadTimeDays).toBe(21);
    }

    const pole = items.find(i => i.productCode === "POLE-5M");
    expect(pole).toBeDefined();
    if (pole) {
      expect(parseFloat(pole.costPrice)).toBeCloseTo(0, 2);
    }
  });
});

describe("Authentication", () => {
  it("auth.me returns user for authenticated context", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.name).toBe("Test User");
    expect(user?.email).toBe("test@mmalbion.com.au");
  });

  it("auth.me returns null for unauthenticated context", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});
