import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Company settings - stores MM Albion's business details
 */
export const companySettings = mysqlTable("company_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  abn: varchar("abn", { length: 20 }),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  fax: varchar("fax", { length: 20 }),
  email: varchar("email", { length: 255 }),
  logoUrl: text("logoUrl"), // CDN URL to logo
  standardTerms: text("standardTerms"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = typeof companySettings.$inferInsert;

/**
 * Salespersons - names of sales staff for quotes
 */
export const salespersons = mysqlTable("salespersons", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Salesperson = typeof salespersons.$inferSelect;
export type InsertSalesperson = typeof salespersons.$inferInsert;

/**
 * Suppliers - external vendors providing quotes
 */
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  contact: varchar("contact", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  defaultMarkupPercent: int("defaultMarkupPercent").default(0).notNull(), // Default markup % for this supplier
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

/**
 * Projects/Tenders - customer projects requiring quotes
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerContact: varchar("customerContact", { length: 255 }),
  customerEmail: varchar("customerEmail", { length: 255 }),
  customerAddress: text("customerAddress"),
  status: mysqlEnum("status", ["pending", "sent", "in_progress", "won", "lost"]).default("pending").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Supplier Quotes - uploaded supplier quotes linked to projects
 */
export const supplierQuotes = mysqlTable("supplier_quotes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id),
  supplierId: int("supplierId").notNull().references(() => suppliers.id),
  quoteNumber: varchar("quoteNumber", { length: 100 }),
  quoteDate: timestamp("quoteDate"),
  pdfUrl: text("pdfUrl"), // CDN URL to uploaded PDF
  extractedAt: timestamp("extractedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SupplierQuote = typeof supplierQuotes.$inferSelect;
export type InsertSupplierQuote = typeof supplierQuotes.$inferInsert;

/**
 * Line Items - individual items extracted from supplier quotes
 */
export const lineItems = mysqlTable("line_items", {
  id: int("id").autoincrement().primaryKey(),
  supplierQuoteId: int("supplierQuoteId").notNull().references(() => supplierQuotes.id),
  itemNumber: int("itemNumber"), // Sequential number from supplier quote
  type: varchar("type", { length: 100 }), // e.g., "AH1 BULB", "AL3", etc.
  productCode: varchar("productCode", { length: 255 }).notNull(),
  description: text("description"),
  quantity: int("quantity").notNull(),
  unitOfMeasure: varchar("unitOfMeasure", { length: 50 }).default("EA"), // EA, m, box, etc.
  costPrice: decimal("costPrice", { precision: 12, scale: 4 }).notNull(), // Supplier unit price (never shown to customer)
  leadTimeDays: int("leadTimeDays"), // Lead time in days
  markupPercent: int("markupPercent"), // Per-line-item markup override (null = use supplier default or global)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LineItem = typeof lineItems.$inferSelect;
export type InsertLineItem = typeof lineItems.$inferInsert;

/**
 * Customer Quotes - outgoing quotes to customers (can have multiple versions)
 */
export const customerQuotes = mysqlTable("customer_quotes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id),
  quoteNumber: varchar("quoteNumber", { length: 50 }).notNull(), // e.g., "880-306403"
  versionNumber: int("versionNumber").default(0).notNull(), // 0, 1, 2, etc. for versioning
  salespersonId: int("salespersonId").references(() => salespersons.id),
  customerPoNumber: varchar("customerPoNumber", { length: 100 }),
  jobTitle: varchar("jobTitle", { length: 255 }),
  globalMarkupPercent: int("globalMarkupPercent"), // Global markup override (null = use per-supplier/per-line defaults)
  validFromDate: timestamp("validFromDate").defaultNow().notNull(),
  validToDate: timestamp("validToDate").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "accepted", "won", "lost"]).default("draft").notNull(),
  pdfUrl: text("pdfUrl"), // CDN URL to generated PDF
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerQuote = typeof customerQuotes.$inferSelect;
export type InsertCustomerQuote = typeof customerQuotes.$inferInsert;

/**
 * Customer Quote Line Items - line items included in a specific customer quote
 */
export const customerQuoteLineItems = mysqlTable("customer_quote_line_items", {
  id: int("id").autoincrement().primaryKey(),
  customerQuoteId: int("customerQuoteId").notNull().references(() => customerQuotes.id),
  lineItemId: int("lineItemId").notNull().references(() => lineItems.id),
  quantity: int("quantity").notNull(), // May differ from source line item
  description: text("description"), // May be edited from source
  costPrice: decimal("costPrice", { precision: 12, scale: 4 }).notNull(), // Locked cost at time of quote
  markupPercent: int("markupPercent").notNull(), // Applied markup % for this line
  sellPrice: decimal("sellPrice", { precision: 12, scale: 4 }).notNull(), // Calculated sell price (cost * (1 + markup/100))
  lineOrder: int("lineOrder").notNull(), // Sort order in quote
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomerQuoteLineItem = typeof customerQuoteLineItems.$inferSelect;
export type InsertCustomerQuoteLineItem = typeof customerQuoteLineItems.$inferInsert;

/**
 * Project Suppliers - tracks which suppliers are expected to provide quotes for each project.
 * The "pricing received" status is derived automatically by checking if a supplier_quote
 * exists for the same project + supplier combination.
 */
export const projectSuppliers = mysqlTable("project_suppliers", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id),
  supplierId: int("supplierId").notNull().references(() => suppliers.id),
  notes: text("notes"), // Optional notes about what this supplier is quoting
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectSupplier = typeof projectSuppliers.$inferSelect;
export type InsertProjectSupplier = typeof projectSuppliers.$inferInsert;