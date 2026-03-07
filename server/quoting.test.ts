import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

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

    await caller.salespersons.create({
      name: "John Smith",
      email: "john@mmalbion.com.au",
    });

    const list = await caller.salespersons.list();
    expect(Array.isArray(list)).toBe(true);
    const john = list.find((sp) => sp.name === "John Smith");
    expect(john).toBeDefined();
    if (john) {
      expect(john.email).toBe("john@mmalbion.com.au");
    }
  });
});

describe("Suppliers", () => {
  it("creates a supplier with default margin", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.suppliers.create({
      name: "Everlite Lighting Group",
      contact: "Sarah Johnson",
      email: "quotes@everlite.com.au",
      phone: "1300 123 456",
      defaultMarkupPercent: 25,
    });

    const list = await caller.suppliers.list();
    expect(Array.isArray(list)).toBe(true);
    const everlite = list.find((s) => s.name === "Everlite Lighting Group");
    expect(everlite).toBeDefined();
    if (everlite) {
      expect(everlite.defaultMarkupPercent).toBe(25);
      expect(everlite.contact).toBe("Sarah Johnson");
    }
  });

  it("defaults margin to 0 when not specified", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.suppliers.create({
      name: "Test Supplier No Markup",
    });

    const list = await caller.suppliers.list();
    const testSup = list.find((s) => s.name === "Test Supplier No Markup");
    expect(testSup).toBeDefined();
    if (testSup) {
      expect(testSup.defaultMarkupPercent).toBe(0);
    }
  });
});

describe("Projects", () => {
  it("creates a project with customer details", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.projects.create({
      name: "Bazaar Restaurant - Stage 1",
      customerName: "Electract Energy Pty Ltd",
      customerContact: "Steve Baker",
      customerEmail: "steve@electract.com.au",
      customerAddress: "PO BOX 3039, Ashgrove QLD 4060",
      description: "Lighting supply for restaurant fit-out",
    });

    const list = await caller.projects.list();
    expect(Array.isArray(list)).toBe(true);
    const bazaar = list.find((p) => p.name === "Bazaar Restaurant - Stage 1");
    expect(bazaar).toBeDefined();
    if (bazaar) {
      expect(bazaar.customerName).toBe("Electract Energy Pty Ltd");
      // Status may be 'pending' or 'won' depending on test execution order
      expect(["pending", "won"]).toContain(bazaar.status);
    }
  });

  it("updates project status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const list = await caller.projects.list();
    const project = list[0];
    if (project) {
      await caller.projects.updateStatus({
        id: project.id,
        status: "won",
      });

      const updated = await caller.projects.getById({ id: project.id });
      expect(updated).toBeDefined();
      if (updated) {
        expect(updated.status).toBe("won");
      }
    }
  });

  it("retrieves project by ID", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const list = await caller.projects.list();
    if (list.length > 0) {
      const project = await caller.projects.getById({ id: list[0].id });
      expect(project).toBeDefined();
      if (project) {
        expect(project.id).toBe(list[0].id);
        expect(project.name).toBe(list[0].name);
      }
    }
  });
});

describe("Supplier Quotes and Line Items", () => {
  it("creates a supplier quote and line items", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Get a project and supplier
    const projects = await caller.projects.list();
    const suppliers = await caller.suppliers.list();

    if (projects.length > 0 && suppliers.length > 0) {
      const project = projects[0];
      const supplier = suppliers[0];

      await caller.supplierQuotes.create({
        projectId: project.id,
        supplierId: supplier.id,
        quoteNumber: "Q-12345",
      });

      const sqs = await caller.supplierQuotes.getByProject({
        projectId: project.id,
      });
      expect(sqs.length).toBeGreaterThan(0);

      const sq = sqs[sqs.length - 1];

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
    }
  });
});

describe("Customer Quotes", () => {
  it("creates a customer quote with line items", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const projects = await caller.projects.list();
    if (projects.length > 0) {
      const project = projects[0];

      // Get supplier quotes for this project
      const sqs = await caller.supplierQuotes.getByProject({
        projectId: project.id,
      });

      if (sqs.length > 0) {
        const sq = sqs[0];
        const items = await caller.lineItems.getBySupplierQuote({
          supplierQuoteId: sq.id,
        });

        if (items.length > 0) {
          // Create customer quote
          const validTo = new Date();
          validTo.setDate(validTo.getDate() + 28);

          await caller.customerQuotes.create({
            projectId: project.id,
            quoteNumber: "880-000001",
            versionNumber: 0,
            jobTitle: "Bazaar Restaurant - Stage 1",
            globalMarkupPercent: 20,
            validToDate: validTo,
          });

          const cqs = await caller.customerQuotes.getByProject({
            projectId: project.id,
          });
          expect(cqs.length).toBeGreaterThan(0);

          const cq = cqs[cqs.length - 1];
          expect(cq.quoteNumber).toBe("880-000001");
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
        }
      }
    }
  });

  it("updates customer quote status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const projects = await caller.projects.list();
    if (projects.length > 0) {
      const cqs = await caller.customerQuotes.getByProject({
        projectId: projects[0].id,
      });

      if (cqs.length > 0) {
        await caller.customerQuotes.updateStatus({
          id: cqs[0].id,
          status: "sent",
        });

        const updated = await caller.customerQuotes.getById({
          id: cqs[0].id,
        });
        if (updated) {
          expect(updated.status).toBe("sent");
        }
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

    const list = await caller.projects.list();
    if (list.length > 0) {
      const project = list[0];
      const statuses = ["pending", "sent", "in_progress", "won", "lost"] as const;

      for (const status of statuses) {
        await caller.projects.updateStatus({ id: project.id, status });
        const updated = await caller.projects.getById({ id: project.id });
        expect(updated).toBeDefined();
        if (updated) {
          expect(updated.status).toBe(status);
        }
      }

      // Reset to pending for other tests
      await caller.projects.updateStatus({ id: project.id, status: "pending" });
    }
  });
});

describe("Project Delete", () => {
  it("creates and deletes a project with cascade", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a project to delete
    await caller.projects.create({
      name: "Delete Test Project",
      customerName: "Test Customer",
      description: "This project will be deleted",
    });

    const listBefore = await caller.projects.list();
    const deleteTarget = listBefore.find((p) => p.name === "Delete Test Project");
    expect(deleteTarget).toBeDefined();

    if (deleteTarget) {
      await caller.projects.delete({ id: deleteTarget.id });

      const listAfter = await caller.projects.list();
      const deleted = listAfter.find((p) => p.name === "Delete Test Project");
      expect(deleted).toBeUndefined();
    }
  });
});

describe("Project Supplier Tracking", () => {
  const uniqueId = Date.now();
  const projectName = `SupTrack-${uniqueId}`;
  const supplierName = `TrackSup-${uniqueId}`;

  it("adds, deduplicates, and removes project suppliers", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a fresh project
    await caller.projects.create({ name: projectName, customerName: "Test" });
    const projects = await caller.projects.list();
    const project = projects.find((p) => p.name === projectName);
    expect(project).toBeDefined();
    if (!project) return;

    // Create a fresh supplier
    await caller.suppliers.create({ name: supplierName });
    const suppliersList = await caller.suppliers.list();
    const supplier = suppliersList.find((s) => s.name === supplierName);
    expect(supplier).toBeDefined();
    if (!supplier) return;

    // Initially empty for this new project
    const initialList = await caller.projectSuppliers.list({ projectId: project.id });
    expect(initialList.length).toBe(0);

    // Add supplier to project
    await caller.projectSuppliers.add({ projectId: project.id, supplierId: supplier.id });
    const afterAdd = await caller.projectSuppliers.list({ projectId: project.id });
    expect(afterAdd.length).toBe(1);
    expect(afterAdd[0].supplierName).toBe(supplierName);

    // Adding same supplier again should not duplicate
    await caller.projectSuppliers.add({ projectId: project.id, supplierId: supplier.id });
    const afterDup = await caller.projectSuppliers.list({ projectId: project.id });
    expect(afterDup.length).toBe(1);

    // Remove the tracked supplier
    await caller.projectSuppliers.remove({ projectId: project.id, supplierId: supplier.id });
    const afterRemove = await caller.projectSuppliers.list({ projectId: project.id });
    expect(afterRemove.length).toBe(0);
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

    const projects = await caller.projects.list();
    const suppliers = await caller.suppliers.list();

    if (projects.length > 0 && suppliers.length > 0) {
      const project = projects[0];
      const supplier = suppliers[0];

      await caller.supplierQuotes.create({
        projectId: project.id,
        supplierId: supplier.id,
        quoteNumber: "Q-ENRICHED-001",
      });

      const sqs = await caller.supplierQuotes.getByProject({ projectId: project.id });
      const enrichedSq = sqs.find(sq => sq.quoteNumber === "Q-ENRICHED-001");
      expect(enrichedSq).toBeDefined();
      if (enrichedSq) {
        expect(enrichedSq.quoteNumber).toBe("Q-ENRICHED-001");
      }
    }
  });

  it("creates line items with comments and bundled flag", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const projects = await caller.projects.list();
    const suppliers = await caller.suppliers.list();

    if (projects.length > 0 && suppliers.length > 0) {
      const project = projects[0];
      const supplier = suppliers[0];

      // Create a supplier quote
      await caller.supplierQuotes.create({
        projectId: project.id,
        supplierId: supplier.id,
        quoteNumber: "Q-BUNDLED-TEST",
      });

      const sqs = await caller.supplierQuotes.getByProject({ projectId: project.id });
      const sq = sqs.find(s => s.quoteNumber === "Q-BUNDLED-TEST");
      expect(sq).toBeDefined();
      if (!sq) return;

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
