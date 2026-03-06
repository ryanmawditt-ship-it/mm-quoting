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
          content: `You are a data extraction specialist. Extract all line items AND supplier company information from the supplier quote PDF.

For the supplier, extract:
- supplierName: the name of the company that issued this quote
- supplierContact: contact person name if available
- supplierEmail: email address if available
- supplierPhone: phone number if available

For each line item, extract:
- itemNumber: the sequential number (integer)
- type: the item type code (e.g., "AH1 BULB", "AL3", etc.)
- productCode: the product/part code
- description: full product description
- quantity: number of units (integer)
- unitPrice: unit price as a number (no currency symbols)
- leadTimeDays: lead time in days if mentioned (integer or null)
- unitOfMeasure: unit of measure (default "EA")

Also extract:
- quoteNumber: the supplier's quote reference number
- quoteDate: the date of the quote (ISO format)

Return ONLY valid JSON. Do not include any markdown formatting or code blocks.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all line items and supplier information from this supplier quote PDF. Return the data as JSON.",
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
              supplierName: { type: "string", description: "Name of the supplier company" },
              supplierContact: { type: ["string", "null"], description: "Contact person name" },
              supplierEmail: { type: ["string", "null"], description: "Supplier email" },
              supplierPhone: { type: ["string", "null"], description: "Supplier phone" },
              quoteNumber: { type: ["string", "null"], description: "Supplier quote reference number" },
              quoteDate: { type: ["string", "null"], description: "Quote date in ISO format" },
              lineItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    itemNumber: { type: ["number", "null"] },
                    type: { type: ["string", "null"] },
                    productCode: { type: "string" },
                    description: { type: "string" },
                    quantity: { type: "number" },
                    unitPrice: { type: "number" },
                    leadTimeDays: { type: ["number", "null"] },
                    unitOfMeasure: { type: "string" },
                  },
                  required: ["productCode", "description", "quantity", "unitPrice", "unitOfMeasure"],
                  additionalProperties: false,
                },
              },
            },
            required: ["supplierName", "supplierContact", "supplierEmail", "supplierPhone", "quoteNumber", "quoteDate", "lineItems"],
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
      res.status(500).json({ error: "Failed to parse extracted data from PDF" });
      return;
    }

    // 3. Auto-create or find the supplier from extracted info
    const supplierName = extracted.supplierName || "Unknown Supplier";
    const supplierId = await getOrCreateSupplierByName(
      user.id,
      supplierName,
      extracted.supplierContact || undefined,
      extracted.supplierEmail || undefined,
      extracted.supplierPhone || undefined
    );

    // 4. Create supplier quote record
    await createSupplierQuote(
      parseInt(projectId),
      supplierId,
      extracted.quoteNumber || undefined,
      extracted.quoteDate ? new Date(extracted.quoteDate) : undefined,
      pdfUrl
    );

    // Get the inserted ID
    const allSqs = await getSupplierQuotesByProject(parseInt(projectId));
    const supplierQuote = allSqs[allSqs.length - 1];

    if (!supplierQuote) {
      res.status(500).json({ error: "Failed to create supplier quote" });
      return;
    }

    // 5. Save extracted line items to database
    const savedItems: any[] = [];
    if (extracted.lineItems && Array.isArray(extracted.lineItems)) {
      for (const item of extracted.lineItems) {
        await createLineItem(
          supplierQuote.id,
          item.productCode || "UNKNOWN",
          item.description || "",
          item.quantity || 1,
          String(item.unitPrice || 0),
          item.itemNumber,
          item.type,
          item.unitOfMeasure || "EA",
          item.leadTimeDays,
          undefined
        );
        savedItems.push({
          type: item.type,
          productCode: item.productCode,
          description: item.description,
          quantity: item.quantity,
          costPrice: String(item.unitPrice),
          leadTimeDays: item.leadTimeDays,
          unitOfMeasure: item.unitOfMeasure,
        });
      }
    }

    res.json({
      success: true,
      supplierQuoteId: supplierQuote.id,
      supplierName,
      supplierId,
      quoteNumber: extracted.quoteNumber,
      quoteDate: extracted.quoteDate,
      extractedItems: savedItems,
      itemCount: savedItems.length,
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    res.status(500).json({ error: "Failed to process supplier quote PDF" });
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

    const { projectId, items, salespersonId, jobTitle, validDays, globalMarginPercent } = req.body;

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
// PDF Generation Function
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
}

async function generateQuotePDF(data: QuotePDFData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 80; // 40px margins each side
      const settings = data.settings;

      // ---- HEADER ----
      // Company name
      doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a365d");
      doc.text(settings?.companyName || "MM Albion", 40, 40);
      
      doc.fontSize(8).font("Helvetica").fillColor("#4a5568");
      let headerY = 62;
      if (settings?.abn) {
        doc.text(`ABN: ${settings.abn}`, 40, headerY);
        headerY += 12;
      }
      if (settings?.address) {
        doc.text(settings.address, 40, headerY);
        headerY += 12;
      }
      const contactLine = [settings?.phone, settings?.fax ? `Fax: ${settings.fax}` : null, settings?.email].filter(Boolean).join("  |  ");
      if (contactLine) {
        doc.text(contactLine, 40, headerY);
        headerY += 12;
      }

      // Logo on the right side
      if (settings?.logoUrl) {
        try {
          const logoResponse = await fetch(settings.logoUrl);
          if (logoResponse.ok) {
            const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
            doc.image(logoBuffer, doc.page.width - 180, 35, { width: 140, fit: [140, 60] });
          }
        } catch {
          // Skip logo if fetch fails
        }
      }

      // ---- QUOTATION TITLE ----
      headerY += 8;
      doc.moveTo(40, headerY).lineTo(doc.page.width - 40, headerY).strokeColor("#1a365d").lineWidth(2).stroke();
      headerY += 12;

      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a365d");
      doc.text("QUOTATION", 40, headerY, { align: "center" });
      headerY += 24;

      // ---- QUOTE DETAILS ----
      const leftCol = 40;
      const rightCol = doc.page.width / 2 + 20;
      const labelWidth = 100;

      // Left side - Quote To
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a365d");
      doc.text("Quote To:", leftCol, headerY);
      doc.fontSize(9).font("Helvetica").fillColor("#333");
      headerY += 14;
      doc.text(data.project.customerName, leftCol, headerY);
      headerY += 12;
      if (data.project.customerContact) {
        doc.text(`Attn: ${data.project.customerContact}`, leftCol, headerY);
        headerY += 12;
      }
      if (data.project.customerAddress) {
        doc.text(data.project.customerAddress, leftCol, headerY, { width: 220 });
        headerY += 12;
      }
      if (data.project.customerEmail) {
        doc.text(data.project.customerEmail, leftCol, headerY);
        headerY += 12;
      }

      // Right side - Quote details
      let rightY = headerY - (data.project.customerContact ? 50 : 38);
      const drawField = (label: string, value: string, y: number) => {
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#666");
        doc.text(label, rightCol, y, { width: labelWidth });
        doc.fontSize(9).font("Helvetica").fillColor("#333");
        doc.text(value, rightCol + labelWidth, y);
        return y + 14;
      };

      rightY = drawField("Quotation No:", data.quoteNumber, rightY);
      rightY = drawField("Date:", data.quoteDate.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }), rightY);
      rightY = drawField("Valid To:", data.validToDate.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }), rightY);
      if (data.salespersonName) {
        rightY = drawField("Sale Person:", data.salespersonName, rightY);
      }
      rightY = drawField("Job Title:", data.jobTitle, rightY);

      headerY = Math.max(headerY, rightY) + 16;

      // ---- LINE ITEMS TABLE ----
      // Table header
      const colWidths = {
        partNo: 90,
        description: 180,
        lt: 30,
        qty: 35,
        uom: 30,
        unitPrice: 60,
        gstAmt: 55,
        lineValue: 70,
      };

      const tableLeft = 40;
      let tableY = headerY;

      // Header row background
      doc.rect(tableLeft, tableY, pageWidth, 18).fillColor("#1a365d").fill();

      doc.fontSize(7).font("Helvetica-Bold").fillColor("#fff");
      let colX = tableLeft + 4;
      doc.text("Part Number", colX, tableY + 5, { width: colWidths.partNo });
      colX += colWidths.partNo;
      doc.text("Description", colX, tableY + 5, { width: colWidths.description });
      colX += colWidths.description;
      doc.text("LT", colX, tableY + 5, { width: colWidths.lt, align: "right" });
      colX += colWidths.lt;
      doc.text("Qty", colX, tableY + 5, { width: colWidths.qty, align: "right" });
      colX += colWidths.qty;
      doc.text("UOM", colX, tableY + 5, { width: colWidths.uom, align: "center" });
      colX += colWidths.uom;
      doc.text("Unit Price", colX, tableY + 5, { width: colWidths.unitPrice, align: "right" });
      colX += colWidths.unitPrice;
      doc.text("GST Amt", colX, tableY + 5, { width: colWidths.gstAmt, align: "right" });
      colX += colWidths.gstAmt;
      doc.text("Line Value", colX, tableY + 5, { width: colWidths.lineValue, align: "right" });

      tableY += 18;

      // Data rows
      let totalExclGst = 0;
      let totalGst = 0;

      for (let i = 0; i < data.lineItems.length; i++) {
        const item = data.lineItems[i];
        const lineValueExclGst = item.sellPrice * item.quantity;
        const gstAmt = lineValueExclGst * 0.1;
        const lineValueInclGst = lineValueExclGst + gstAmt;

        totalExclGst += lineValueExclGst;
        totalGst += gstAmt;

        // Check if we need a new page
        if (tableY > doc.page.height - 120) {
          doc.addPage();
          tableY = 40;
        }

        // Alternate row background
        if (i % 2 === 0) {
          doc.rect(tableLeft, tableY, pageWidth, 16).fillColor("#f7fafc").fill();
        }

        doc.fontSize(7).font("Helvetica").fillColor("#333");
        colX = tableLeft + 4;
        doc.text(item.productCode, colX, tableY + 4, { width: colWidths.partNo - 4 });
        colX += colWidths.partNo;

        // Truncate description to fit
        const desc = item.description.length > 60 ? item.description.substring(0, 57) + "..." : item.description;
        doc.text(desc, colX, tableY + 4, { width: colWidths.description - 4 });
        colX += colWidths.description;

        doc.text(item.leadTimeDays ? String(item.leadTimeDays) : "-", colX, tableY + 4, { width: colWidths.lt, align: "right" });
        colX += colWidths.lt;
        doc.text(String(item.quantity), colX, tableY + 4, { width: colWidths.qty, align: "right" });
        colX += colWidths.qty;
        doc.text(item.unitOfMeasure, colX, tableY + 4, { width: colWidths.uom, align: "center" });
        colX += colWidths.uom;
        doc.text(`$${item.sellPrice.toFixed(2)}`, colX, tableY + 4, { width: colWidths.unitPrice, align: "right" });
        colX += colWidths.unitPrice;
        doc.text(`$${gstAmt.toFixed(2)}`, colX, tableY + 4, { width: colWidths.gstAmt, align: "right" });
        colX += colWidths.gstAmt;
        doc.text(`$${lineValueInclGst.toFixed(2)}`, colX, tableY + 4, { width: colWidths.lineValue, align: "right" });

        tableY += 16;
      }

      // ---- TOTALS ----
      tableY += 8;
      const totalsX = doc.page.width - 40 - 200;

      doc.moveTo(totalsX, tableY).lineTo(doc.page.width - 40, tableY).strokeColor("#ccc").lineWidth(0.5).stroke();
      tableY += 6;

      doc.fontSize(9).font("Helvetica").fillColor("#333");
      doc.text("Total Excl. GST:", totalsX, tableY, { width: 120 });
      doc.text(`$${totalExclGst.toFixed(2)}`, totalsX + 120, tableY, { width: 80, align: "right" });
      tableY += 14;

      doc.text("GST (10%):", totalsX, tableY, { width: 120 });
      doc.text(`$${totalGst.toFixed(2)}`, totalsX + 120, tableY, { width: 80, align: "right" });
      tableY += 14;

      doc.moveTo(totalsX, tableY).lineTo(doc.page.width - 40, tableY).strokeColor("#1a365d").lineWidth(1).stroke();
      tableY += 6;

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a365d");
      doc.text("Total Incl. GST:", totalsX, tableY, { width: 120 });
      doc.text(`$${(totalExclGst + totalGst).toFixed(2)}`, totalsX + 120, tableY, { width: 80, align: "right" });

      // ---- TERMS ----
      if (settings?.standardTerms) {
        tableY += 30;
        if (tableY > doc.page.height - 100) {
          doc.addPage();
          tableY = 40;
        }
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a365d");
        doc.text("Terms & Conditions", 40, tableY);
        tableY += 14;
        doc.fontSize(7).font("Helvetica").fillColor("#666");
        doc.text(settings.standardTerms, 40, tableY, { width: pageWidth, lineGap: 2 });
      }

      // ---- FOOTER ----
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).font("Helvetica").fillColor("#999");
        doc.text(
          `Page ${i + 1} of ${pageCount}`,
          40,
          doc.page.height - 30,
          { width: pageWidth, align: "center" }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
