import { eq, inArray, and, ne, sql, count, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, companySettings, InsertCompanySettings, salespersons, suppliers, projects, supplierQuotes, lineItems, customerQuotes, customerQuoteLineItems, projectSuppliers } from "../drizzle/schema";
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
export async function getCompanySettings(userId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  // Single-company app: return the first settings row regardless of userId
  // This ensures password-auth users and OAuth users share the same company settings
  const result = await db.select().from(companySettings).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertCompanySettings(userId: number, data: Omit<InsertCompanySettings, 'userId'>) {
  const db = await getDb();
  if (!db) return;
  // Single-company app: update the first existing row regardless of userId, or create new
  const existing = await db.select({ id: companySettings.id }).from(companySettings).limit(1);
  if (existing.length > 0) {
    // Update existing row
    await db.update(companySettings).set(data).where(eq(companySettings.id, existing[0].id));
  } else {
    // Insert new row
    await db.insert(companySettings).values({ ...data, userId });
  }
}

/**
 * Salespersons
 */
export async function getSalespersons(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  // Single-company app: return all salespersons regardless of userId
  return db.select().from(salespersons);
}

export async function createSalesperson(userId: number, name: string, email?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(salespersons).values({ userId, name, email });
}

/**
 * Suppliers
 */
export async function getSuppliers(userId?: number, includeArchived: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  // Single-company app: return all suppliers regardless of userId
  if (includeArchived) {
    return db.select().from(suppliers);
  }
  return db.select().from(suppliers).where(eq(suppliers.isArchived, 0));
}

export async function getArchivedSuppliers(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  // Single-company app: return all archived suppliers regardless of userId
  return db.select().from(suppliers).where(eq(suppliers.isArchived, 1));
}

export async function archiveSupplier(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(suppliers).set({ isArchived: 1, updatedAt: new Date() }).where(eq(suppliers.id, id));
}

export async function unarchiveSupplier(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(suppliers).set({ isArchived: 0, updatedAt: new Date() }).where(eq(suppliers.id, id));
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

export async function updateSupplier(id: number, data: { name?: string; contact?: string | null; email?: string | null; phone?: string | null; defaultMarkupPercent?: number }) {
  const db = await getDb();
  if (!db) return;
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.contact !== undefined) updateSet.contact = data.contact;
  if (data.email !== undefined) updateSet.email = data.email;
  if (data.phone !== undefined) updateSet.phone = data.phone;
  if (data.defaultMarkupPercent !== undefined) updateSet.defaultMarkupPercent = data.defaultMarkupPercent;
  if (Object.keys(updateSet).length === 0) return;
  await db.update(suppliers).set(updateSet).where(eq(suppliers.id, id));
}

/**
 * Delete a supplier and cascade: re-assign or delete related supplier_quotes,
 * line_items, customer_quote_line_items, and project_suppliers.
 */
export async function deleteSupplier(supplierId: number) {
  const db = await getDb();
  if (!db) return;

  // Get all supplier quotes for this supplier
  const sqList = await db.select({ id: supplierQuotes.id }).from(supplierQuotes).where(eq(supplierQuotes.supplierId, supplierId));
  const sqIds = sqList.map(sq => sq.id);

  if (sqIds.length > 0) {
    // Get all line items for those supplier quotes
    const liList = await db.select({ id: lineItems.id }).from(lineItems).where(inArray(lineItems.supplierQuoteId, sqIds));
    const liIds = liList.map(li => li.id);

    // Delete customer quote line items that reference these line items
    if (liIds.length > 0) {
      await db.delete(customerQuoteLineItems).where(inArray(customerQuoteLineItems.lineItemId, liIds));
    }

    // Delete line items
    await db.delete(lineItems).where(inArray(lineItems.supplierQuoteId, sqIds));

    // Delete supplier quotes
    await db.delete(supplierQuotes).where(eq(supplierQuotes.supplierId, supplierId));
  }

  // Delete project supplier tracking entries
  await db.delete(projectSuppliers).where(eq(projectSuppliers.supplierId, supplierId));

  // Delete the supplier itself
  await db.delete(suppliers).where(eq(suppliers.id, supplierId));
}

/**
 * Normalise a supplier name for matching: lowercase, strip common suffixes
 * (PTY, LTD, GROUP, INC, CO, CORP, SPECIALISTS, AGENCIES), remove non-alphanumeric.
 */
export function normaliseSupplierName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(pty|ltd|group|inc|co|corp|specialists?|agencies|australia|aust|au)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export async function getOrCreateSupplierByName(userId: number, name: string, contact?: string, email?: string, phone?: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const normInput = normaliseSupplierName(name);

  // Single-company app: fetch all suppliers regardless of userId for matching
  const existing = await db.select().from(suppliers);

  // 1. Try exact normalised match
  let match = existing.find(s => normaliseSupplierName(s.name) === normInput);

  // 2. Try "contains" match (one name is a substring of the other after normalisation)
  if (!match) {
    match = existing.find(s => {
      const normExisting = normaliseSupplierName(s.name);
      return normExisting.includes(normInput) || normInput.includes(normExisting);
    });
  }

  if (match) {
    // Update contact details if the existing record is missing them and we have new ones
    const updates: Record<string, string> = {};
    if (!match.contact && contact) updates.contact = contact;
    if (!match.email && email) updates.email = email;
    if (!match.phone && phone) updates.phone = phone;
    if (Object.keys(updates).length > 0) {
      await db.update(suppliers).set(updates).where(eq(suppliers.id, match.id));
    }
    return match.id;
  }

  // Create new supplier only if no match found
  const result = await db.insert(suppliers).values({ userId, name, contact, email, phone, defaultMarkupPercent: 0 });
  return result[0].insertId;
}

/**
 * Projects
 */
export async function getProjects(userId?: number, includeArchived: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  // Single-company app: return all projects regardless of userId
  if (includeArchived) {
    return db.select().from(projects);
  }
  return db.select().from(projects).where(ne(projects.status, "archived"));
}

export async function getArchivedProjects(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  // Single-company app: return all archived projects regardless of userId
  return db.select().from(projects).where(eq(projects.status, "archived"));
}

export async function archiveProject(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set({ status: "archived", updatedAt: new Date() }).where(eq(projects.id, id));
}

export async function unarchiveProject(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set({ status: "pending", updatedAt: new Date() }).where(eq(projects.id, id));
}

export async function createProject(userId: number, name: string, customerName: string, customerContact?: string, customerEmail?: string, customerAddress?: string, description?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projects).values({ userId, name, customerName, customerContact, customerEmail, customerAddress, description });
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateProjectStatus(id: number, status: 'pending' | 'sent' | 'in_progress' | 'won' | 'lost' | 'archived') {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set({ status, updatedAt: new Date() }).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) return;

  // Get all supplier quotes for this project
  const sqList = await db.select({ id: supplierQuotes.id }).from(supplierQuotes).where(eq(supplierQuotes.projectId, id));
  const sqIds = sqList.map(sq => sq.id);

  // Get all line items for those supplier quotes
  if (sqIds.length > 0) {
    const liList = await db.select({ id: lineItems.id }).from(lineItems).where(inArray(lineItems.supplierQuoteId, sqIds));
    const liIds = liList.map(li => li.id);

    // Delete customer quote line items that reference these line items
    if (liIds.length > 0) {
      await db.delete(customerQuoteLineItems).where(inArray(customerQuoteLineItems.lineItemId, liIds));
    }

    // Delete line items
    await db.delete(lineItems).where(inArray(lineItems.supplierQuoteId, sqIds));
  }

  // Delete project suppliers
  await db.delete(projectSuppliers).where(eq(projectSuppliers.projectId, id));

  // Delete customer quotes for this project
  await db.delete(customerQuotes).where(eq(customerQuotes.projectId, id));

  // Delete supplier quotes
  await db.delete(supplierQuotes).where(eq(supplierQuotes.projectId, id));

  // Delete the project itself
  await db.delete(projects).where(eq(projects.id, id));
}

/**
 * Delete a single supplier quote and its associated line items + customer quote line items
 */
export async function deleteSupplierQuote(supplierQuoteId: number) {
  const db = await getDb();
  if (!db) return;

  // Get all line items for this supplier quote
  const liList = await db.select({ id: lineItems.id }).from(lineItems).where(eq(lineItems.supplierQuoteId, supplierQuoteId));
  const liIds = liList.map(li => li.id);

  // Delete customer quote line items that reference these line items
  if (liIds.length > 0) {
    await db.delete(customerQuoteLineItems).where(inArray(customerQuoteLineItems.lineItemId, liIds));
  }

  // Delete line items
  await db.delete(lineItems).where(eq(lineItems.supplierQuoteId, supplierQuoteId));

  // Delete the supplier quote itself
  await db.delete(supplierQuotes).where(eq(supplierQuotes.id, supplierQuoteId));
}

/**
 * Supplier Quotes
 */
export async function createSupplierQuote(projectId: number, supplierId: number, quoteNumber?: string, quoteDate?: Date, pdfUrl?: string, quoteExpiry?: Date, validityDays?: number, deliveryNotes?: string) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(supplierQuotes).values({ projectId, supplierId, quoteNumber, quoteDate, pdfUrl, quoteExpiry, validityDays, deliveryNotes });
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
export async function createLineItem(supplierQuoteId: number, productCode: string, description: string, quantity: number, costPrice: string | number, itemNumber?: number, type?: string, unitOfMeasure?: string, leadTimeDays?: number, markupPercent?: number, comments?: string, totalPrice?: string | number, isBundled?: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.insert(lineItems).values({
    supplierQuoteId, itemNumber, type, productCode, description, comments,
    quantity, unitOfMeasure, costPrice: String(costPrice),
    totalPrice: totalPrice != null ? String(totalPrice) : undefined,
    isBundled: isBundled ? 1 : 0,
    leadTimeDays, markupPercent,
  });
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
export async function createCustomerQuoteLineItem(customerQuoteId: number, lineItemId: number, quantity: number, description: string, costPrice: string | number, marginPercent: number, lineOrder: number, itemType?: string) {
  const db = await getDb();
  if (!db) return;
  const costNum = typeof costPrice === 'string' ? parseFloat(costPrice) : costPrice;
  // Margin formula: Sell Price = Cost / (1 - margin/100)
  const sellPrice = marginPercent >= 100 ? costNum : costNum / (1 - marginPercent / 100);
  await db.insert(customerQuoteLineItems).values({ customerQuoteId, lineItemId, quantity, description, costPrice: String(costPrice), markupPercent: marginPercent, sellPrice: String(sellPrice), lineOrder, itemType: itemType || null });
}

export async function getCustomerQuoteLineItems(customerQuoteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customerQuoteLineItems).where(eq(customerQuoteLineItems.customerQuoteId, customerQuoteId));
}

/**
 * Update the saved margin percentage on a supplier line item
 */
export async function updateLineItemMargin(id: number, marginPercent: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(lineItems).set({ markupPercent: marginPercent }).where(eq(lineItems.id, id));
}

/**
 * Bulk update margins for multiple line items at once
 */
export async function updateLineItemMargins(items: Array<{ id: number; marginPercent: number }>) {
  const db = await getDb();
  if (!db) return;
  for (const item of items) {
    await db.update(lineItems).set({ markupPercent: item.marginPercent }).where(eq(lineItems.id, item.id));
  }
}

/**
 * Project Suppliers - tracking which suppliers are expected to quote on a project
 */
export async function getProjectSuppliers(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: projectSuppliers.id,
    projectId: projectSuppliers.projectId,
    supplierId: projectSuppliers.supplierId,
    notes: projectSuppliers.notes,
    createdAt: projectSuppliers.createdAt,
    supplierName: suppliers.name,
    supplierContact: suppliers.contact,
    supplierEmail: suppliers.email,
    supplierPhone: suppliers.phone,
  })
    .from(projectSuppliers)
    .innerJoin(suppliers, eq(projectSuppliers.supplierId, suppliers.id))
    .where(eq(projectSuppliers.projectId, projectId));
}

export async function addProjectSupplier(projectId: number, supplierId: number, notes?: string) {
  const db = await getDb();
  if (!db) return;
  // Check if already exists
  const existing = await db.select()
    .from(projectSuppliers)
    .where(and(eq(projectSuppliers.projectId, projectId), eq(projectSuppliers.supplierId, supplierId)))
    .limit(1);
  if (existing.length > 0) return; // Already tracked
  await db.insert(projectSuppliers).values({ projectId, supplierId, notes });
}

export async function removeProjectSupplier(projectId: number, supplierId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectSuppliers).where(
    and(eq(projectSuppliers.projectId, projectId), eq(projectSuppliers.supplierId, supplierId))
  );
}

export async function updateProjectSupplierNotes(projectId: number, supplierId: number, notes: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(projectSuppliers).set({ notes }).where(
    and(eq(projectSuppliers.projectId, projectId), eq(projectSuppliers.supplierId, supplierId))
  );
}

/**
 * Delete a customer quote and its line items
 */
export async function deleteCustomerQuote(id: number) {
  const db = await getDb();
  if (!db) return;
  // Delete line items first (foreign key)
  await db.delete(customerQuoteLineItems).where(eq(customerQuoteLineItems.customerQuoteId, id));
  // Delete the quote itself
  await db.delete(customerQuotes).where(eq(customerQuotes.id, id));
}

/**
 * Analytics - global management dashboard queries
 */

export async function getAnalyticsOverview() {
  const db = await getDb();
  if (!db) return null;

  // Total projects (excluding archived)
  const totalProjectsResult = await db.select({ count: count() }).from(projects).where(ne(projects.status, "archived"));
  const totalProjects = totalProjectsResult[0]?.count ?? 0;

  // Projects by status
  const projectsByStatus = await db.select({
    status: projects.status,
    count: count(),
  }).from(projects).where(ne(projects.status, "archived")).groupBy(projects.status);

  // Total customer quotes
  const totalQuotesResult = await db.select({ count: count() }).from(customerQuotes);
  const totalQuotes = totalQuotesResult[0]?.count ?? 0;

  // Customer quotes by status
  const quotesByStatus = await db.select({
    status: customerQuotes.status,
    count: count(),
  }).from(customerQuotes).groupBy(customerQuotes.status);

  // Total revenue from won quotes (sum of sellPrice * quantity for won customer quotes)
  const wonQuoteIds = await db.select({ id: customerQuotes.id })
    .from(customerQuotes)
    .where(eq(customerQuotes.status, "won"));
  const wonIds = wonQuoteIds.map(q => q.id);

  let totalWonRevenue = 0;
  if (wonIds.length > 0) {
    const revenueResult = await db.select({
      total: sql<string>`SUM(CAST(${customerQuoteLineItems.sellPrice} AS DECIMAL(12,4)) * ${customerQuoteLineItems.quantity})`
    }).from(customerQuoteLineItems).where(inArray(customerQuoteLineItems.customerQuoteId, wonIds));
    totalWonRevenue = parseFloat(revenueResult[0]?.total ?? '0');
  }

  // Total value of all quotes sent (sum of sellPrice * quantity for all customer quotes)
  let totalQuotedValue = 0;
  if (totalQuotes > 0) {
    const quotedResult = await db.select({
      total: sql<string>`SUM(CAST(${customerQuoteLineItems.sellPrice} AS DECIMAL(12,4)) * ${customerQuoteLineItems.quantity})`
    }).from(customerQuoteLineItems);
    totalQuotedValue = parseFloat(quotedResult[0]?.total ?? '0');
  }

  // Total cost value (for margin calculation)
  let totalCostValue = 0;
  if (wonIds.length > 0) {
    const costResult = await db.select({
      total: sql<string>`SUM(CAST(${customerQuoteLineItems.costPrice} AS DECIMAL(12,4)) * ${customerQuoteLineItems.quantity})`
    }).from(customerQuoteLineItems).where(inArray(customerQuoteLineItems.customerQuoteId, wonIds));
    totalCostValue = parseFloat(costResult[0]?.total ?? '0');
  }

  return {
    totalProjects,
    projectsByStatus,
    totalQuotes,
    quotesByStatus,
    totalWonRevenue,
    totalQuotedValue,
    totalCostValue,
    averageMargin: totalWonRevenue > 0 ? ((totalWonRevenue - totalCostValue) / totalWonRevenue) * 100 : 0,
  };
}

export async function getAnalyticsByCustomer() {
  const db = await getDb();
  if (!db) return [];

  // Get all non-archived projects with their customer names
  const allProjects = await db.select({
    id: projects.id,
    customerName: projects.customerName,
    status: projects.status,
  }).from(projects).where(ne(projects.status, "archived"));

  // Get all customer quotes with their project IDs
  const allCustomerQuotes = await db.select({
    id: customerQuotes.id,
    projectId: customerQuotes.projectId,
    status: customerQuotes.status,
  }).from(customerQuotes);

  // Get all customer quote line items for value calculations
  const allLineItemsData = await db.select({
    customerQuoteId: customerQuoteLineItems.customerQuoteId,
    sellPrice: customerQuoteLineItems.sellPrice,
    costPrice: customerQuoteLineItems.costPrice,
    quantity: customerQuoteLineItems.quantity,
  }).from(customerQuoteLineItems);

  // Build a map of quoteId -> total sell value and cost value
  const quoteValues = new Map<number, { sell: number; cost: number }>();
  for (const li of allLineItemsData) {
    const existing = quoteValues.get(li.customerQuoteId) ?? { sell: 0, cost: 0 };
    existing.sell += parseFloat(String(li.sellPrice)) * li.quantity;
    existing.cost += parseFloat(String(li.costPrice)) * li.quantity;
    quoteValues.set(li.customerQuoteId, existing);
  }

  // Build a map of projectId -> customerName
  const projectCustomerMap = new Map<number, string>();
  for (const p of allProjects) {
    projectCustomerMap.set(p.id, p.customerName);
  }

  // Aggregate by customer name
  const customerStats = new Map<string, {
    customerName: string;
    totalProjects: number;
    totalQuotes: number;
    wonQuotes: number;
    lostQuotes: number;
    totalQuotedValue: number;
    totalWonValue: number;
    totalCostValue: number;
  }>();

  // Count projects per customer
  for (const p of allProjects) {
    const name = p.customerName;
    if (!customerStats.has(name)) {
      customerStats.set(name, {
        customerName: name,
        totalProjects: 0,
        totalQuotes: 0,
        wonQuotes: 0,
        lostQuotes: 0,
        totalQuotedValue: 0,
        totalWonValue: 0,
        totalCostValue: 0,
      });
    }
    customerStats.get(name)!.totalProjects++;
  }

  // Count quotes per customer
  for (const q of allCustomerQuotes) {
    const customerName = projectCustomerMap.get(q.projectId);
    if (!customerName) continue;
    if (!customerStats.has(customerName)) {
      customerStats.set(customerName, {
        customerName,
        totalProjects: 0,
        totalQuotes: 0,
        wonQuotes: 0,
        lostQuotes: 0,
        totalQuotedValue: 0,
        totalWonValue: 0,
        totalCostValue: 0,
      });
    }
    const stats = customerStats.get(customerName)!;
    stats.totalQuotes++;
    const values = quoteValues.get(q.id) ?? { sell: 0, cost: 0 };
    stats.totalQuotedValue += values.sell;
    if (q.status === 'won' || q.status === 'accepted') {
      stats.wonQuotes++;
      stats.totalWonValue += values.sell;
      stats.totalCostValue += values.cost;
    } else if (q.status === 'lost') {
      stats.lostQuotes++;
    }
  }

  return Array.from(customerStats.values()).sort((a, b) => b.totalQuotedValue - a.totalQuotedValue);
}

export async function getAnalyticsTimeline() {
  const db = await getDb();
  if (!db) return [];

  // Get customer quotes with creation dates for timeline
  const quotes = await db.select({
    id: customerQuotes.id,
    status: customerQuotes.status,
    createdAt: customerQuotes.createdAt,
    projectId: customerQuotes.projectId,
  }).from(customerQuotes).orderBy(customerQuotes.createdAt);

  // Get line item totals per quote
  const allLineItemsData = await db.select({
    customerQuoteId: customerQuoteLineItems.customerQuoteId,
    sellPrice: customerQuoteLineItems.sellPrice,
    quantity: customerQuoteLineItems.quantity,
  }).from(customerQuoteLineItems);

  const quoteValues = new Map<number, number>();
  for (const li of allLineItemsData) {
    const existing = quoteValues.get(li.customerQuoteId) ?? 0;
    quoteValues.set(li.customerQuoteId, existing + parseFloat(String(li.sellPrice)) * li.quantity);
  }

  // Group by month
  const monthlyData = new Map<string, { month: string; quotesCreated: number; quotesWon: number; totalValue: number; wonValue: number }>();

  for (const q of quotes) {
    const date = new Date(q.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { month: monthKey, quotesCreated: 0, quotesWon: 0, totalValue: 0, wonValue: 0 });
    }
    const data = monthlyData.get(monthKey)!;
    data.quotesCreated++;
    const value = quoteValues.get(q.id) ?? 0;
    data.totalValue += value;
    if (q.status === 'won' || q.status === 'accepted') {
      data.quotesWon++;
      data.wonValue += value;
    }
  }

  return Array.from(monthlyData.values()).sort((a, b) => a.month.localeCompare(b.month));
}
