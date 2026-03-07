import { Router, Request, Response } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";
import {
  createSupplierQuote,
  createLineItem,
  getSupplierQuotesByProject,
  getCustomerQuotesByProject,
  getProjectById,
  getCompanySettings,
  getLineItemById,
  getLineItemsBySupplierQuote,
  getSupplierById,
  getOrCreateSupplierByName,
  createCustomerQuote,
  createCustomerQuoteLineItem,
  getCustomerQuoteLineItems,
  getCustomerQuoteById,
  getSalespersons,
  addProjectSupplier,
} from "./db";
import PDFDocument from "pdfkit";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

export const apiRouter = Router();

/**
 * Get the user from the request. Falls back to a default site user
 * when no authentication is configured.
 */
const DEFAULT_SITE_USER = {
  id: 1,
  openId: "site-user",
  name: "MM Albion",
  email: null,
  loginMethod: "none",
  role: "admin",
};

async function authenticateRequest(req: Request): Promise<any> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user;
  } catch {
    // No session — return default site user so API routes work without auth
    return DEFAULT_SITE_USER;
  }
}

// ============================================================
// POST /api/upload-supplier-pdf
// Uploads a supplier quote PDF, uses AI to extract line items
// ============================================================
apiRouter.post("/api/upload-supplier-pdf", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const file = req.file;
    const { projectId } = req.body;

    if (!file || !projectId) {
      res.status(400).json({ error: "Missing file or projectId" });
      return;
    }

    // 1. Upload PDF to S3
    const fileKey = `supplier-pdfs/${user.id}/${nanoid()}-${file.originalname}`;
    const { url: pdfUrl } = await storagePut(fileKey, file.buffer, "application/pdf");

    // 2. Use AI to extract line items AND supplier info from the PDF
    const extractionResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert data extraction specialist for Australian electrical supplier quotes. Your job is to extract EVERY line item and supplier information from supplier quote PDFs with perfect accuracy.

You will encounter quotes from various Australian electrical suppliers. Here are known formats you must handle:

**RAYLINC AGENCIES PTY LTD:**
- Columns: Product Code | Type | Description | Quantity | Price Ex GST | Total Ex GST
- "Type" column contains area/section codes like PL1, 1S, 2S — these identify which area of the project the item belongs to
- CRITICAL: Some items have NO unit price shown (e.g., poles, powdercoat, foundation cages). These are BUNDLED items included in the price of the main luminaire. Extract them with unitPrice=0 and set isBundled=true
- Page 1 often contains **QUOTE_NOTES** and **NOTE** sections — these are NOT line items, do NOT extract them as items
- Actual product line items start with a product code like "108-1554", "STM-RP-5.0-160-90-PC", "FC-4M20-233X1.0-K", "FREIGHT"
- Freight is always a separate line item
- Validity: 30 days (stated in notes)

**LUXSON ILLUMINATION:**
- Columns: Product name and additional info | Qty | Price | Unit | Sum
- Items grouped under bold section headers like "TYPE W2", "FREIGHT" — these headers have section subtotals
- Section headers are NOT line items — only extract actual products under them
- The section header name (e.g., "TYPE W2") should be used as the "type" field for items under it
- CRITICAL: Uses space-separated thousands in numbers (e.g., "5 393.29" means 5393.29, "4 541.46" means 4541.46). Parse these correctly!
- Product code is on the first line, description on the second line of each item
- "Unit" column values like "Pce", "Per Delivery" map to unitOfMeasure
- Validity: 30 days
- Lead times in T&Cs: local 4-6 weeks, imported 10-12 weeks

**CLEVERTRONICS:**
- Columns: Type Number | Product Code | Item Description | Comments | Qty | Unit Price | Extended Price
- "Type Number" contains fixture type codes like 2S, 1E, 2E, 3E/4E, 5E, 6E
- Has a "Comments" column with per-item notes (IK ratings, special requests like "As requested in take off")
- CRITICAL: Some items may have quantity=0 with $0.00 total — these are informational/optional items. Still extract them.
- Has explicit Quote Expiry date (e.g., 90 days from quote date)
- "Opp Name" = project name, "Quote Name" = revision info
- Lead times in notes section

**GENERAL RULES FOR ALL SUPPLIERS:**
1. Extract EVERY product line item — do not skip any
2. Do NOT extract notes, terms & conditions, or section headers as line items
3. For descriptions: include the FULL and COMPLETE text exactly as written. Include ALL technical specs, model details, colour temps, wattages, dimensions, finishes. Do NOT truncate or summarise.
4. For numbers: handle comma-separated (2,950.00), space-separated (5 393.29), and plain formats. Strip currency symbols ($, AUD). Always return clean decimal numbers.
5. If an item has a "Total" or "Extended Price" but no unit price, calculate: unitPrice = total / quantity. If quantity is 0, use the total as unitPrice.
6. Items with no price at all (bundled accessories) should have unitPrice=0 and isBundled=true
7. Lead times: check per-item columns, general notes, footer, and T&Cs. Convert weeks to days (1 week = 7 days). For ranges like "4-6 weeks", use the higher number (42). "Ex-stock" or "in stock" = 0 days.
8. Quote validity: extract explicit expiry dates, or note the validity period in days (30, 60, 90 days)
9. Freight/delivery items are real line items — extract them with type="FREIGHT"
10. For the supplier name, use the FULL legal company name as shown on the quote header

Return ONLY valid JSON matching the schema. Do not include markdown formatting or code blocks.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all line items and supplier information from this supplier quote PDF. Be thorough — extract every single product line item, including freight, bundled items, and zero-quantity items. Pay special attention to number formatting (spaces vs commas as thousands separators).",
            },
            {
              type: "file_url",
              file_url: {
                url: pdfUrl,
                mime_type: "application/pdf",
              },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "supplier_quote_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              supplierName: { type: "string", description: "Full legal name of the supplier company" },
              supplierContact: { type: ["string", "null"], description: "Contact person name (e.g., sales rep, quoted by)" },
              supplierEmail: { type: ["string", "null"], description: "Supplier email address" },
              supplierPhone: { type: ["string", "null"], description: "Supplier phone number" },
              supplierAbn: { type: ["string", "null"], description: "Supplier ABN if shown" },
              quoteNumber: { type: ["string", "null"], description: "Supplier quote reference number" },
              quoteDate: { type: ["string", "null"], description: "Quote date in ISO format (YYYY-MM-DD)" },
              quoteExpiryDate: { type: ["string", "null"], description: "Quote expiry date in ISO format if explicitly stated" },
              validityDays: { type: ["number", "null"], description: "Number of days the quote is valid (e.g., 30, 60, 90)" },
              projectName: { type: ["string", "null"], description: "Project name as shown on the quote" },
              lineItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    itemNumber: { type: ["number", "null"], description: "Sequential item number" },
                    type: { type: ["string", "null"], description: "Area/section/type code (e.g., PL1, 1S, 2S, TYPE W2, 1E, FREIGHT)" },
                    productCode: { type: "string", description: "Product/part code" },
                    description: { type: "string", description: "Full product description with all specs" },
                    comments: { type: ["string", "null"], description: "Per-item notes or comments (e.g., IK ratings, special requests)" },
                    quantity: { type: "number", description: "Number of units (can be 0 for informational items)" },
                    unitPrice: { type: "number", description: "Unit price as a decimal number (0 for bundled items with no separate price)" },
                    totalPrice: { type: ["number", "null"], description: "Extended/total price if shown on the quote" },
                    isBundled: { type: "boolean", description: "True if this item has no separate price and is bundled/included with another item" },
                    leadTimeDays: { type: ["number", "null"], description: "Item-specific lead time in days" },
                    unitOfMeasure: { type: "string", description: "Unit of measure (EA, Pce, m, Per Delivery, etc.)" },
                  },
                  required: ["productCode", "description", "quantity", "unitPrice", "unitOfMeasure", "isBundled"],
                  additionalProperties: false,
                },
              },
              generalLeadTimeDays: { type: ["number", "null"], description: "Blanket lead time for all items in days" },
              deliveryNotes: { type: ["string", "null"], description: "Delivery/freight terms and notes" },
              subtotalExGst: { type: ["number", "null"], description: "Subtotal excluding GST" },
              gstAmount: { type: ["number", "null"], description: "GST amount" },
              totalIncGst: { type: ["number", "null"], description: "Total including GST" },
            },
            required: ["supplierName", "supplierContact", "supplierEmail", "supplierPhone", "supplierAbn", "quoteNumber", "quoteDate", "quoteExpiryDate", "validityDays", "projectName", "lineItems", "generalLeadTimeDays", "deliveryNotes", "subtotalExGst", "gstAmount", "totalIncGst"],
            additionalProperties: false,
          },
        },
      },
    });

    let extracted: any;
    try {
      const content = extractionResult.choices[0]?.message?.content;
      const textContent = typeof content === "string" ? content : (content as any)?.[0]?.text || "";
      // Strip markdown code blocks if present
      const cleaned = textContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      extracted = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("[Extraction] Failed to parse LLM response:", parseError);
      console.error("[Extraction] Raw content:", extractionResult.choices[0]?.message?.content);
      res.status(500).json({ error: "Failed to parse extracted data from PDF. The AI could not read this document format. Please try again or contact support." });
      return;
    }

    // Validate extraction has at least some data
    if (!extracted.lineItems || !Array.isArray(extracted.lineItems) || extracted.lineItems.length === 0) {
      console.warn("[Extraction] No line items found in extraction result");
      res.status(422).json({
        error: "No line items could be extracted from this PDF. The document may not be a recognisable supplier quote format.",
        supplierName: extracted.supplierName || null,
        quoteNumber: extracted.quoteNumber || null,
      });
      return;
    }

    // 3. Sanitise extracted numbers — handle space-separated thousands, currency symbols, etc.
    const sanitiseNumber = (val: any): number => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        // Remove currency symbols, AUD prefix, and whitespace used as thousands separator
        const cleaned = val.replace(/[\$AUD]/gi, "").replace(/(\d)\s+(\d)/g, "$1$2").replace(/,/g, "").trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };

    // 4. Auto-create or find the supplier from extracted info
    const supplierName = extracted.supplierName || "Unknown Supplier";
    const supplierId = await getOrCreateSupplierByName(
      user.id,
      supplierName,
      extracted.supplierContact || undefined,
      extracted.supplierEmail || undefined,
      extracted.supplierPhone || undefined
    );

    // 5. Auto-add this supplier to the project's tracked suppliers list
    try {
      await addProjectSupplier(parseInt(projectId), supplierId);
    } catch (e) {
      // Non-critical — supplier tracking is a convenience feature
      console.warn("[Upload] Could not auto-track supplier:", e);
    }

    // 6. Calculate quote expiry
    let quoteExpiry: Date | undefined;
    const validityDays = extracted.validityDays || null;
    if (extracted.quoteExpiryDate) {
      quoteExpiry = new Date(extracted.quoteExpiryDate);
    } else if (extracted.quoteDate && validityDays) {
      quoteExpiry = new Date(extracted.quoteDate);
      quoteExpiry.setDate(quoteExpiry.getDate() + validityDays);
    }

    // 7. Create supplier quote record with enriched data
    await createSupplierQuote(
      parseInt(projectId),
      supplierId,
      extracted.quoteNumber || undefined,
      extracted.quoteDate ? new Date(extracted.quoteDate) : undefined,
      pdfUrl,
      quoteExpiry,
      validityDays,
      extracted.deliveryNotes || undefined
    );

    // Get the inserted ID
    const allSqs = await getSupplierQuotesByProject(parseInt(projectId));
    const supplierQuote = allSqs[allSqs.length - 1];

    if (!supplierQuote) {
      res.status(500).json({ error: "Failed to create supplier quote" });
      return;
    }

    // Use general lead time as fallback for items without specific lead times
    const generalLT = extracted.generalLeadTimeDays || null;

    // 8. Save extracted line items to database with enriched data
    const savedItems: any[] = [];
    let itemIdx = 0;
    for (const item of extracted.lineItems) {
      itemIdx++;
      // Use item-specific lead time, or fall back to general lead time
      const itemLeadTime = item.leadTimeDays ?? generalLT;
      const unitPrice = sanitiseNumber(item.unitPrice);
      const totalPrice = item.totalPrice != null ? sanitiseNumber(item.totalPrice) : null;
      const quantity = typeof item.quantity === "number" ? item.quantity : parseInt(item.quantity) || 0;
      const isBundled = item.isBundled === true || (unitPrice === 0 && quantity > 0 && !item.productCode?.toUpperCase().includes("FREIGHT"));

      await createLineItem(
        supplierQuote.id,
        item.productCode || "UNKNOWN",
        item.description || "",
        quantity,
        String(unitPrice),
        item.itemNumber ?? itemIdx,
        item.type || null,
        item.unitOfMeasure || "EA",
        itemLeadTime,
        undefined, // markupPercent
        item.comments || null,
        totalPrice != null ? String(totalPrice) : undefined,
        isBundled
      );
      savedItems.push({
        type: item.type,
        productCode: item.productCode,
        description: item.description,
        comments: item.comments || null,
        quantity,
        costPrice: String(unitPrice),
        totalPrice: totalPrice != null ? String(totalPrice) : null,
        isBundled,
        leadTimeDays: itemLeadTime,
        unitOfMeasure: item.unitOfMeasure,
      });
    }

    // 9. Build summary for response
    const bundledCount = savedItems.filter(i => i.isBundled).length;
    const pricedCount = savedItems.filter(i => !i.isBundled && parseFloat(i.costPrice) > 0).length;
    const zeroQtyCount = savedItems.filter(i => i.quantity === 0).length;

    res.json({
      success: true,
      supplierQuoteId: supplierQuote.id,
      supplierName,
      supplierId,
      quoteNumber: extracted.quoteNumber,
      quoteDate: extracted.quoteDate,
      quoteExpiryDate: quoteExpiry?.toISOString() || null,
      validityDays,
      projectName: extracted.projectName || null,
      generalLeadTimeDays: generalLT,
      deliveryNotes: extracted.deliveryNotes || null,
      subtotalExGst: extracted.subtotalExGst || null,
      gstAmount: extracted.gstAmount || null,
      totalIncGst: extracted.totalIncGst || null,
      extractedItems: savedItems,
      itemCount: savedItems.length,
      pricedCount,
      bundledCount,
      zeroQtyCount,
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    res.status(500).json({ error: "Failed to process supplier quote PDF. Please try again." });
  }
});

// ============================================================
// POST /api/generate-customer-quote
// Generates a customer-facing quote PDF with markup applied
// ============================================================
apiRouter.post("/api/generate-customer-quote", async (req: Request, res: Response) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { projectId, items, salespersonId, jobTitle, validDays, globalMarginPercent, customerDetails, deliverTo, specialInstructions } = req.body;

    if (!projectId || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Missing projectId or items" });
      return;
    }

    // Get project details
    const project = await getProjectById(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Get company settings
    const settings = await getCompanySettings(user.id);

    // Get existing customer quotes for versioning
    const existingQuotes = await getCustomerQuotesByProject(projectId);
    
    // Generate quote number: use project ID based format
    const baseQuoteNumber = `880-${String(projectId).padStart(6, "0")}`;
    const versionNumber = existingQuotes.filter(q => q.quoteNumber === baseQuoteNumber).length;

    // Calculate valid-to date
    const validToDate = new Date();
    validToDate.setDate(validToDate.getDate() + (validDays || 28));

    // Create customer quote record
    await createCustomerQuote(
      projectId,
      baseQuoteNumber,
      versionNumber,
      salespersonId ? parseInt(salespersonId) : undefined,
      undefined,
      jobTitle || project.name,
      globalMarginPercent,
      validToDate
    );

    // Get the created quote
    const allCqs = await getCustomerQuotesByProject(projectId);
    const customerQuote = allCqs[allCqs.length - 1];

    if (!customerQuote) {
      res.status(500).json({ error: "Failed to create customer quote" });
      return;
    }

    // Create customer quote line items
    const quoteLineItems: Array<{
      lineOrder: number;
      productCode: string;
      description: string;
      quantity: number;
      costPrice: number;
      marginPercent: number;
      sellPrice: number;
      leadTimeDays: number | null;
      unitOfMeasure: string;
    }> = [];

    for (const item of items) {
      const costPrice = typeof item.costPrice === "string" ? parseFloat(item.costPrice) : item.costPrice;
      const marginPercent = item.marginPercent || globalMarginPercent || 0;
      // Margin formula: Sell Price = Cost / (1 - margin/100)
      const sellPrice = marginPercent >= 100 ? costPrice : costPrice / (1 - marginPercent / 100);

      // Get the original line item for product code and lead time
      const origItem = await getLineItemById(item.lineItemId);

      await createCustomerQuoteLineItem(
        customerQuote.id,
        item.lineItemId,
        item.quantity,
        item.description || origItem?.description || "",
        String(costPrice),
        marginPercent,
        item.lineOrder
      );

      quoteLineItems.push({
        lineOrder: item.lineOrder,
        productCode: origItem?.productCode || "",
        description: item.description || origItem?.description || "",
        quantity: item.quantity,
        costPrice,
        marginPercent,
        sellPrice,
        leadTimeDays: origItem?.leadTimeDays || null,
        unitOfMeasure: origItem?.unitOfMeasure || "EA",
      });
    }

    // Sort by line order
    quoteLineItems.sort((a, b) => a.lineOrder - b.lineOrder);

    // Get salesperson name
    let salespersonName = "";
    if (salespersonId) {
      const sps = await getSalespersons(user.id);
      const sp = sps.find(s => s.id === parseInt(salespersonId));
      salespersonName = sp?.name || "";
    }

    // Generate PDF
    const pdfBuffer = await generateQuotePDF({
      quoteNumber: `${baseQuoteNumber}-${String(versionNumber).padStart(3, "0")}`,
      quoteDate: new Date(),
      validToDate,
      project,
      settings,
      salespersonName,
      jobTitle: jobTitle || project.name,
      lineItems: quoteLineItems,
      customerDetails: customerDetails || null,
      deliverTo: deliverTo || null,
      specialInstructions: specialInstructions || "",
    });

    // Upload PDF to S3
    const pdfKey = `customer-quotes/${user.id}/${baseQuoteNumber}-${String(versionNumber).padStart(3, "0")}-${nanoid(6)}.pdf`;
    const { url: pdfUrl } = await storagePut(pdfKey, pdfBuffer, "application/pdf");

    // Update the customer quote with the PDF URL
    // We'll do a direct DB update since we don't have a dedicated helper
    const { getDb } = await import("./db");
    const db = await getDb();
    if (db) {
      const { customerQuotes: cqTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(cqTable).set({ pdfUrl }).where(eq(cqTable.id, customerQuote.id));
    }

    res.json({
      success: true,
      quoteId: customerQuote.id,
      quoteNumber: `${baseQuoteNumber}-${String(versionNumber).padStart(3, "0")}`,
      pdfUrl,
    });
  } catch (error) {
    console.error("[GenerateQuote] Error:", error);
    res.status(500).json({ error: "Failed to generate customer quote" });
  }
});

// ============================================================
// PDF Generation Function — Modern Professional Design
// ============================================================
interface QuotePDFData {
  quoteNumber: string;
  quoteDate: Date;
  validToDate: Date;
  project: any;
  settings: any;
  salespersonName: string;
  jobTitle: string;
  lineItems: Array<{
    lineOrder: number;
    productCode: string;
    description: string;
    quantity: number;
    costPrice: number;
    marginPercent: number;
    sellPrice: number;
    leadTimeDays: number | null;
    unitOfMeasure: string;
  }>;
  customerDetails: {
    name: string;
    contact: string;
    email: string;
    phone: string;
    address: string;
  } | null;
  deliverTo: {
    name: string;
    address: string;
  } | null;
  specialInstructions: string;
}

// Colour palette
const C = {
  navy: "#0f2b46",
  accent: "#2563eb",
  accentLight: "#eff6ff",
  dark: "#1e293b",
  body: "#334155",
  muted: "#64748b",
  light: "#94a3b8",
  border: "#e2e8f0",
  rowAlt: "#f8fafc",
  white: "#ffffff",
};

function fmtMoney(n: number): string {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

async function generateQuotePDF(data: QuotePDFData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const ML = 50;  // margin left
      const MR = 50;  // margin right
      const MT = 45;  // margin top
      const MB = 60;  // margin bottom

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: MT, bottom: MB, left: ML, right: MR },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const PW = doc.page.width;   // 595.28 for A4
      const PH = doc.page.height;  // 841.89 for A4
      const CW = PW - ML - MR;    // content width
      const settings = data.settings;

      // ================================================================
      // Helper: draw the table header row (reused on each page)
      // ================================================================
      const COL = {
        num:   { w: 28,  align: "left"   as const },
        code:  { w: 100, align: "left"   as const },
        desc:  { w: 175, align: "left"   as const },
        lt:    { w: 32,  align: "center" as const },
        qty:   { w: 32,  align: "center" as const },
        uom:   { w: 32,  align: "center" as const },
        price: { w: 68,  align: "right"  as const },
        total: { w: 78,  align: "right"  as const },
      };
      // Remaining space distributed to desc
      const usedW = COL.num.w + COL.code.w + COL.lt.w + COL.qty.w + COL.uom.w + COL.price.w + COL.total.w;
      COL.desc.w = CW - usedW - 16; // 16 for padding

      const MIN_ROW_H = 22;
      const HDR_H = 26;
      const ROW_PAD_TOP = 6;
      const ROW_PAD_BOT = 6;
      const DESC_FONT_SIZE = 7;

      // Helper: measure the height a description will need
      const measureDescHeight = (text: string): number => {
        const descW = COL.desc.w - 4;
        doc.fontSize(DESC_FONT_SIZE).font("Helvetica");
        const h = doc.heightOfString(text, { width: descW });
        return h;
      };

      const drawTableHeader = (y: number): number => {
        // Header background
        doc.save();
        doc.roundedRect(ML, y, CW, HDR_H, 3).fillColor(C.navy).fill();
        doc.restore();

        doc.fontSize(7).font("Helvetica-Bold").fillColor(C.white);
        let x = ML + 8;
        doc.text("#",           x, y + 8, { width: COL.num.w,   align: COL.num.align });
        x += COL.num.w;
        doc.text("Part Number", x, y + 8, { width: COL.code.w,  align: COL.code.align });
        x += COL.code.w;
        doc.text("Description", x, y + 8, { width: COL.desc.w,  align: COL.desc.align });
        x += COL.desc.w;
        doc.text("LT",          x, y + 8, { width: COL.lt.w,    align: COL.lt.align });
        x += COL.lt.w;
        doc.text("Qty",         x, y + 8, { width: COL.qty.w,   align: COL.qty.align });
        x += COL.qty.w;
        doc.text("UOM",         x, y + 8, { width: COL.uom.w,   align: COL.uom.align });
        x += COL.uom.w;
        doc.text("Unit Price",  x, y + 8, { width: COL.price.w, align: COL.price.align });
        x += COL.price.w;
        doc.text("Line Total",  x, y + 8, { width: COL.total.w, align: COL.total.align });

        return y + HDR_H;
      }

      // ================================================================
      // PAGE 1 — HEADER
      // ================================================================
      let Y = MT;

      // ---- Accent bar at very top ----
      doc.save();
      doc.rect(0, 0, PW, 6).fillColor(C.accent).fill();
      doc.restore();

      // ---- Logo (left) ----
      let logoLoaded = false;
      if (settings?.logoUrl) {
        try {
          const logoResponse = await fetch(settings.logoUrl);
          if (logoResponse.ok) {
            const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
            doc.image(logoBuffer, ML, Y + 4, { fit: [120, 50] });
            logoLoaded = true;
          }
        } catch { /* skip */ }
      }

      // ---- Company name + details (left, below logo or at top) ----
      const companyBlockY = logoLoaded ? Y + 58 : Y;
      doc.fontSize(16).font("Helvetica-Bold").fillColor(C.navy);
      doc.text(settings?.companyName || "MM Albion", ML, companyBlockY);

      let subY = companyBlockY + 20;
      doc.fontSize(8).font("Helvetica").fillColor(C.muted);
      if (settings?.abn) {
        doc.text(`ABN ${settings.abn}`, ML, subY);
        subY += 11;
      }
      if (settings?.address) {
        doc.text(settings.address, ML, subY, { width: 220 });
        subY += 11;
      }
      const contactParts = [settings?.phone, settings?.fax ? `Fax ${settings.fax}` : null, settings?.email].filter(Boolean);
      if (contactParts.length) {
        doc.text(contactParts.join("  \u00B7  "), ML, subY, { width: 280 });
        subY += 11;
      }

      // ---- QUOTATION badge (right side) ----
      const badgeW = 200;
      const badgeX = PW - MR - badgeW;
      doc.save();
      doc.roundedRect(badgeX, Y, badgeW, 28, 4).fillColor(C.navy).fill();
      doc.restore();
      doc.fontSize(13).font("Helvetica-Bold").fillColor(C.white);
      doc.text("QUOTATION", badgeX, Y + 7, { width: badgeW, align: "center" });

      // Quote metadata (right column)
      const metaX = badgeX + 8;
      const metaValX = badgeX + 90;
      let mY = Y + 38;
      const metaLine = (label: string, value: string) => {
        doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.muted);
        doc.text(label, metaX, mY);
        doc.fontSize(8.5).font("Helvetica").fillColor(C.dark);
        doc.text(value, metaValX, mY, { width: badgeW - 90 });
        mY += 14;
      };

      metaLine("Quote No:", data.quoteNumber);
      metaLine("Date:", fmtDate(data.quoteDate));
      metaLine("Valid To:", fmtDate(data.validToDate));
      if (data.salespersonName) metaLine("Contact:", data.salespersonName);
      metaLine("Project:", data.jobTitle);

      Y = Math.max(subY, mY) + 12;

      // ---- Divider ----
      doc.moveTo(ML, Y).lineTo(PW - MR, Y).strokeColor(C.border).lineWidth(1).stroke();
      Y += 14;

      // ---- Quote To / Deliver To ----
      const cust = data.customerDetails;
      const del = data.deliverTo;
      const custName = cust?.name || data.project.customerName || "";
      const custContact = cust?.contact || data.project.customerContact || "";
      const custEmail = cust?.email || data.project.customerEmail || "";
      const custPhone = cust?.phone || "";
      const custAddress = cust?.address || data.project.customerAddress || "";
      const delName = del?.name || custName;
      const delAddress = del?.address || custAddress;

      const halfW = (CW - 20) / 2;

      // Measure Quote To box height dynamically
      let quoteToLines = 1; // company name
      if (custContact) quoteToLines++;
      if (custEmail || custPhone) quoteToLines++;
      if (custAddress) quoteToLines++;
      const boxH = Math.max(70, 28 + quoteToLines * 13);

      // Quote To box
      doc.save();
      doc.roundedRect(ML, Y, halfW, boxH, 4).fillColor(C.accentLight).fill();
      doc.restore();
      doc.fontSize(7).font("Helvetica-Bold").fillColor(C.accent);
      doc.text("QUOTE TO", ML + 12, Y + 8);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(C.dark);
      doc.text(custName, ML + 12, Y + 22, { width: halfW - 24 });
      let qY = Y + 35;
      doc.fontSize(8).font("Helvetica").fillColor(C.body);
      if (custContact) {
        doc.text(`Attn: ${custContact}`, ML + 12, qY, { width: halfW - 24 });
        qY += 11;
      }
      if (custAddress) {
        doc.text(custAddress, ML + 12, qY, { width: halfW - 24 });
        qY += 11;
      }
      const contactParts2 = [custEmail, custPhone].filter(Boolean);
      if (contactParts2.length) {
        doc.text(contactParts2.join("  \u00B7  "), ML + 12, qY, { width: halfW - 24 });
      }

      // Deliver To box
      const dtX = ML + halfW + 20;
      doc.save();
      doc.roundedRect(dtX, Y, halfW, boxH, 4).fillColor(C.accentLight).fill();
      doc.restore();
      doc.fontSize(7).font("Helvetica-Bold").fillColor(C.accent);
      doc.text("DELIVER TO", dtX + 12, Y + 8);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(C.dark);
      doc.text(delName, dtX + 12, Y + 22, { width: halfW - 24 });
      let dY = Y + 35;
      doc.fontSize(8).font("Helvetica").fillColor(C.body);
      if (delAddress) {
        doc.text(delAddress, dtX + 12, dY, { width: halfW - 24 });
      }

      Y += boxH + 12;

      // ================================================================
      // TABLE
      // ================================================================
      let tableY = drawTableHeader(Y);

      let totalExclGst = 0;
      let totalGst = 0;

      for (let i = 0; i < data.lineItems.length; i++) {
        const item = data.lineItems[i];
        const lineExcl = item.sellPrice * item.quantity;
        const lineGst  = lineExcl * 0.1;
        const lineIncl = lineExcl + lineGst;
        totalExclGst += lineExcl;
        totalGst += lineGst;

        // Measure how tall this row needs to be for the full description
        const descHeight = measureDescHeight(item.description);
        const rowH = Math.max(MIN_ROW_H, descHeight + ROW_PAD_TOP + ROW_PAD_BOT);

        // New page check — leave room for totals (~100pt)
        if (tableY + rowH > PH - MB - 100) {
          doc.addPage();
          // Re-draw accent bar
          doc.save();
          doc.rect(0, 0, PW, 6).fillColor(C.accent).fill();
          doc.restore();
          tableY = drawTableHeader(MT + 10);
        }

        // Alternating row bg
        if (i % 2 === 0) {
          doc.save();
          doc.rect(ML, tableY, CW, rowH).fillColor(C.rowAlt).fill();
          doc.restore();
        }

        // Bottom border for each row
        doc.moveTo(ML, tableY + rowH).lineTo(PW - MR, tableY + rowH).strokeColor(C.border).lineWidth(0.3).stroke();

        const rowTextY = tableY + ROW_PAD_TOP;
        doc.fontSize(7.5).font("Helvetica").fillColor(C.body);

        let x = ML + 8;
        doc.text(String(item.lineOrder), x, rowTextY, { width: COL.num.w, align: COL.num.align });
        x += COL.num.w;

        // Product code in slightly bolder style
        doc.font("Helvetica-Bold").fillColor(C.dark);
        doc.text(item.productCode, x, rowTextY, { width: COL.code.w - 4, align: COL.code.align });
        x += COL.code.w;

        // Description — full text, wraps dynamically
        doc.fontSize(DESC_FONT_SIZE).font("Helvetica").fillColor(C.body);
        doc.text(item.description, x, rowTextY, { width: COL.desc.w - 4, align: COL.desc.align });
        x += COL.desc.w;

        // Remaining columns vertically centred in the row
        const centreY = tableY + (rowH / 2) - 4;
        doc.fontSize(7.5);

        doc.font("Helvetica").fillColor(C.muted);
        doc.text(item.leadTimeDays ? `${item.leadTimeDays}d` : "-", x, centreY, { width: COL.lt.w, align: COL.lt.align, lineBreak: false });
        x += COL.lt.w;

        doc.fillColor(C.body);
        doc.text(String(item.quantity), x, centreY, { width: COL.qty.w, align: COL.qty.align, lineBreak: false });
        x += COL.qty.w;

        doc.fillColor(C.muted);
        doc.text(item.unitOfMeasure, x, centreY, { width: COL.uom.w, align: COL.uom.align, lineBreak: false });
        x += COL.uom.w;

        doc.fillColor(C.dark);
        doc.text(`$${fmtMoney(item.sellPrice)}`, x, centreY, { width: COL.price.w, align: COL.price.align, lineBreak: false });
        x += COL.price.w;

        doc.font("Helvetica-Bold").fillColor(C.dark);
        doc.text(`$${fmtMoney(lineExcl)}`, x, centreY, { width: COL.total.w, align: COL.total.align, lineBreak: false });

        tableY += rowH;
      }

      // ================================================================
      // TOTALS
      // ================================================================
      // Check if totals fit on current page
      if (tableY + 90 > PH - MB) {
        doc.addPage();
        doc.save();
        doc.rect(0, 0, PW, 6).fillColor(C.accent).fill();
        doc.restore();
        tableY = MT + 10;
      }

      tableY += 10;
      const totW = 220;
      const totX = PW - MR - totW;

      // Totals box
      doc.save();
      doc.roundedRect(totX, tableY, totW, 72, 4).fillColor(C.accentLight).fill();
      doc.restore();

      const totLabelX = totX + 14;
      const totValX = totX + totW - 14;
      let tY = tableY + 12;

      doc.fontSize(9).font("Helvetica").fillColor(C.body);
      doc.text("Total Excl. GST", totLabelX, tY);
      doc.text(`$${fmtMoney(totalExclGst)}`, totLabelX, tY, { width: totW - 28, align: "right" });
      tY += 16;

      doc.text("GST (10%)", totLabelX, tY);
      doc.text(`$${fmtMoney(totalGst)}`, totLabelX, tY, { width: totW - 28, align: "right" });
      tY += 14;

      // Divider inside box
      doc.moveTo(totLabelX, tY).lineTo(totX + totW - 14, tY).strokeColor(C.accent).lineWidth(1).stroke();
      tY += 8;

      doc.fontSize(11).font("Helvetica-Bold").fillColor(C.navy);
      doc.text("Total Incl. GST", totLabelX, tY);
      doc.text(`$${fmtMoney(totalExclGst + totalGst)}`, totLabelX, tY, { width: totW - 28, align: "right" });

      tableY += 82;

      // ================================================================
      // SPECIAL INSTRUCTIONS & NOTES
      // ================================================================
      if (data.specialInstructions && data.specialInstructions.trim()) {
        // Measure height needed
        doc.fontSize(8).font("Helvetica");
        const instrHeight = doc.heightOfString(data.specialInstructions, { width: CW - 24, lineGap: 3 });
        const instrBoxH = instrHeight + 40; // padding + title

        if (tableY + instrBoxH > PH - MB) {
          doc.addPage();
          doc.save();
          doc.rect(0, 0, PW, 6).fillColor(C.accent).fill();
          doc.restore();
          tableY = MT + 10;
        }

        tableY += 12;

        // Light background box
        doc.save();
        doc.roundedRect(ML, tableY, CW, instrBoxH, 4).fillColor("#fef9e7").fill();
        doc.roundedRect(ML, tableY, CW, instrBoxH, 4).strokeColor("#f59e0b").lineWidth(0.5).stroke();
        doc.restore();

        doc.fontSize(8).font("Helvetica-Bold").fillColor(C.navy);
        doc.text("Special Instructions & Notes", ML + 12, tableY + 10);
        tableY += 26;
        doc.fontSize(8).font("Helvetica").fillColor(C.body);
        doc.text(data.specialInstructions, ML + 12, tableY, { width: CW - 24, lineGap: 3 });
        tableY += instrHeight + 14;
      }

      // ================================================================
      // TERMS & CONDITIONS
      // ================================================================
      if (settings?.standardTerms) {
        doc.fontSize(7).font("Helvetica");
        const termsHeight = doc.heightOfString(settings.standardTerms, { width: CW, lineGap: 3 });

        if (tableY + termsHeight + 30 > PH - MB) {
          doc.addPage();
          doc.save();
          doc.rect(0, 0, PW, 6).fillColor(C.accent).fill();
          doc.restore();
          tableY = MT + 10;
        }
        tableY += 8;
        doc.fontSize(8).font("Helvetica-Bold").fillColor(C.navy);
        doc.text("Terms & Conditions", ML, tableY);
        tableY += 14;
        doc.fontSize(7).font("Helvetica").fillColor(C.muted);
        doc.text(settings.standardTerms, ML, tableY, { width: CW, lineGap: 3 });
      }

      // ================================================================
      // FOOTER — page numbers + accent bar
      // ================================================================
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        // Bottom accent bar
        doc.save();
        doc.rect(0, PH - 6, PW, 6).fillColor(C.accent).fill();
        doc.restore();
        // Page number + quote ref on one line — position in the margin area
        const footerText = `${data.quoteNumber}  \u00B7  Page ${i + 1} of ${pageCount}`;
        doc.fontSize(7).font("Helvetica").fillColor(C.light);
        doc.text(footerText, ML, PH - 28, { width: CW, align: "center", lineBreak: false, height: 12 });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
