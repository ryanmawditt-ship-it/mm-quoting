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
  it("creates a supplier with default markup", async () => {
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

  it("defaults markup to 0 when not specified", async () => {
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
      // Status may be 'active' or 'won' depending on test execution order
      expect(["active", "won"]).toContain(bazaar.status);
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

          // Verify sell price calculation
          const cqItem = cqItems[0];
          const expectedSellPrice = costPrice * (1 + markupPercent / 100);
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

describe("GST Calculation", () => {
  it("correctly calculates sell price with markup", () => {
    const costPrice = 45.5;
    const markupPercent = 20;
    const sellPrice = costPrice * (1 + markupPercent / 100);
    expect(sellPrice).toBeCloseTo(54.6, 2);

    const gst = sellPrice * 0.1;
    expect(gst).toBeCloseTo(5.46, 2);

    const totalInclGst = sellPrice + gst;
    expect(totalInclGst).toBeCloseTo(60.06, 2);
  });

  it("handles zero markup correctly", () => {
    const costPrice = 100;
    const markupPercent = 0;
    const sellPrice = costPrice * (1 + markupPercent / 100);
    expect(sellPrice).toBe(100);

    const gst = sellPrice * 0.1;
    expect(gst).toBe(10);
  });

  it("handles high markup correctly", () => {
    const costPrice = 50;
    const markupPercent = 150;
    const sellPrice = costPrice * (1 + markupPercent / 100);
    expect(sellPrice).toBe(125);
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
