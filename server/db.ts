import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, companySettings, InsertCompanySettings, salespersons, suppliers, projects, supplierQuotes, lineItems, customerQuotes, customerQuoteLineItems } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Company Settings
 */
export async function getCompanySettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companySettings).where(eq(companySettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertCompanySettings(userId: number, data: Omit<InsertCompanySettings, 'userId'>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(companySettings).values({ ...data, userId }).onDuplicateKeyUpdate({
    set: data,
  });
}

/**
 * Salespersons
 */
export async function getSalespersons(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(salespersons).where(eq(salespersons.userId, userId));
}

export async function createSalesperson(userId: number, name: string, email?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(salespersons).values({ userId, name, email });
}

/**
 * Suppliers
 */
export async function getSuppliers(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers).where(eq(suppliers.userId, userId));
}

export async function createSupplier(userId: number, name: string, contact?: string, email?: string, phone?: string, defaultMarkupPercent: number = 0) {
  const db = await getDb();
  if (!db) return;
  await db.insert(suppliers).values({ userId, name, contact, email, phone, defaultMarkupPercent });
}

export async function getSupplierById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrCreateSupplierByName(userId: number, name: string, contact?: string, email?: string, phone?: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Try to find existing supplier by name (case-insensitive)
  const existing = await db.select().from(suppliers).where(eq(suppliers.userId, userId));
  const match = existing.find(s => s.name.toLowerCase().trim() === name.toLowerCase().trim());
  if (match) return match.id;
  // Create new supplier
  const result = await db.insert(suppliers).values({ userId, name, contact, email, phone, defaultMarkupPercent: 0 });
  return result[0].insertId;
}

/**
 * Projects
 */
export async function getProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId));
}

export async function createProject(userId: number, name: string, customerName: string, customerContact?: string, customerEmail?: string, customerAddress?: string, description?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projects).values({ userId, name, customerName, customerContact, customerEmail, customerAddress, description });
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateProjectStatus(id: number, status: 'active' | 'won' | 'lost' | 'follow_up_needed') {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set({ status, updatedAt: new Date() }).where(eq(projects.id, id));
}

/**
 * Supplier Quotes
 */
export async function createSupplierQuote(projectId: number, supplierId: number, quoteNumber?: string, quoteDate?: Date, pdfUrl?: string) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(supplierQuotes).values({ projectId, supplierId, quoteNumber, quoteDate, pdfUrl });
  return result;
}

export async function getSupplierQuotesByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supplierQuotes).where(eq(supplierQuotes.projectId, projectId));
}

export async function getSupplierQuoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(supplierQuotes).where(eq(supplierQuotes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Line Items
 */
export async function createLineItem(supplierQuoteId: number, productCode: string, description: string, quantity: number, costPrice: string | number, itemNumber?: number, type?: string, unitOfMeasure?: string, leadTimeDays?: number, markupPercent?: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(lineItems).values({ supplierQuoteId, itemNumber, type, productCode, description, quantity, unitOfMeasure, costPrice: String(costPrice), leadTimeDays, markupPercent });
}

export async function getLineItemsBySupplierQuote(supplierQuoteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lineItems).where(eq(lineItems.supplierQuoteId, supplierQuoteId));
}

export async function getLineItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(lineItems).where(eq(lineItems.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Customer Quotes
 */
export async function createCustomerQuote(projectId: number, quoteNumber: string, versionNumber: number, salespersonId?: number, customerPoNumber?: string, jobTitle?: string, globalMarkupPercent?: number, validToDate?: Date) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(customerQuotes).values({ projectId, quoteNumber, versionNumber, salespersonId, customerPoNumber, jobTitle, globalMarkupPercent, validToDate: validToDate || new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) });
  return result;
}

export async function getCustomerQuotesByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customerQuotes).where(eq(customerQuotes.projectId, projectId));
}

export async function getCustomerQuoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customerQuotes).where(eq(customerQuotes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateCustomerQuoteStatus(id: number, status: 'draft' | 'sent' | 'accepted' | 'won' | 'lost') {
  const db = await getDb();
  if (!db) return;
  await db.update(customerQuotes).set({ status, updatedAt: new Date() }).where(eq(customerQuotes.id, id));
}

/**
 * Customer Quote Line Items
 */
export async function createCustomerQuoteLineItem(customerQuoteId: number, lineItemId: number, quantity: number, description: string, costPrice: string | number, marginPercent: number, lineOrder: number) {
  const db = await getDb();
  if (!db) return;
  const costNum = typeof costPrice === 'string' ? parseFloat(costPrice) : costPrice;
  // Margin formula: Sell Price = Cost / (1 - margin/100)
  const sellPrice = marginPercent >= 100 ? costNum : costNum / (1 - marginPercent / 100);
  await db.insert(customerQuoteLineItems).values({ customerQuoteId, lineItemId, quantity, description, costPrice: String(costPrice), markupPercent: marginPercent, sellPrice: String(sellPrice), lineOrder });
}

export async function getCustomerQuoteLineItems(customerQuoteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customerQuoteLineItems).where(eq(customerQuoteLineItems.customerQuoteId, customerQuoteId));
}

// TODO: add additional feature queries as needed
