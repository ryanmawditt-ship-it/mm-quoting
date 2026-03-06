import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getCompanySettings,
  upsertCompanySettings,
  getSalespersons,
  createSalesperson,
  getSuppliers,
  createSupplier,
  getProjects,
  createProject,
  getProjectById,
  updateProjectStatus,
  createSupplierQuote,
  getSupplierQuotesByProject,
  createLineItem,
  getLineItemsBySupplierQuote,
  createCustomerQuote,
  getCustomerQuotesByProject,
  getCustomerQuoteById,
  updateCustomerQuoteStatus,
  createCustomerQuoteLineItem,
  getCustomerQuoteLineItems,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Company Settings
  company: router({
    getSettings: protectedProcedure.query(({ ctx }) =>
      getCompanySettings(ctx.user.id)
    ),
    updateSettings: protectedProcedure
      .input(
        z.object({
          companyName: z.string(),
          abn: z.string().optional(),
          address: z.string().optional(),
          phone: z.string().optional(),
          fax: z.string().optional(),
          email: z.string().optional(),
          logoUrl: z.string().optional(),
          standardTerms: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => upsertCompanySettings(ctx.user.id, input)),
  }),

  // Salespersons
  salespersons: router({
    list: protectedProcedure.query(({ ctx }) => getSalespersons(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          email: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createSalesperson(ctx.user.id, input.name, input.email)
      ),
  }),

  // Suppliers
  suppliers: router({
    list: protectedProcedure.query(({ ctx }) => getSuppliers(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          contact: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          defaultMarkupPercent: z.number().default(0),
        })
      )
      .mutation(({ ctx, input }) =>
        createSupplier(
          ctx.user.id,
          input.name,
          input.contact,
          input.email,
          input.phone,
          input.defaultMarkupPercent
        )
      ),
  }),

  // Projects
  projects: router({
    list: protectedProcedure.query(({ ctx }) => getProjects(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          customerName: z.string(),
          customerContact: z.string().optional(),
          customerEmail: z.string().optional(),
          customerAddress: z.string().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createProject(
          ctx.user.id,
          input.name,
          input.customerName,
          input.customerContact,
          input.customerEmail,
          input.customerAddress,
          input.description
        )
      ),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getProjectById(input.id)),
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["active", "won", "lost", "follow_up_needed"]),
        })
      )
      .mutation(({ input }) => updateProjectStatus(input.id, input.status)),
  }),

  // Supplier Quotes
  supplierQuotes: router({
    create: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          supplierId: z.number(),
          quoteNumber: z.string().optional(),
          quoteDate: z.date().optional(),
          pdfUrl: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        createSupplierQuote(
          input.projectId,
          input.supplierId,
          input.quoteNumber,
          input.quoteDate,
          input.pdfUrl
        )
      ),
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => getSupplierQuotesByProject(input.projectId)),
  }),

  // Line Items
  lineItems: router({
    create: protectedProcedure
      .input(
        z.object({
          supplierQuoteId: z.number(),
          itemNumber: z.number().optional(),
          type: z.string().optional(),
          productCode: z.string(),
          description: z.string(),
          quantity: z.number(),
          unitOfMeasure: z.string().optional(),
          costPrice: z.union([z.string(), z.number()]),
          leadTimeDays: z.number().optional(),
          markupPercent: z.number().optional(),
        })
      )
      .mutation(({ input }) =>
        createLineItem(
          input.supplierQuoteId,
          input.productCode,
          input.description,
          input.quantity,
          input.costPrice,
          input.itemNumber,
          input.type,
          input.unitOfMeasure,
          input.leadTimeDays,
          input.markupPercent
        )
      ),
    getBySupplierQuote: protectedProcedure
      .input(z.object({ supplierQuoteId: z.number() }))
      .query(({ input }) => getLineItemsBySupplierQuote(input.supplierQuoteId)),
  }),

  // Customer Quotes
  customerQuotes: router({
    create: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          quoteNumber: z.string(),
          versionNumber: z.number(),
          salespersonId: z.number().optional(),
          customerPoNumber: z.string().optional(),
          jobTitle: z.string().optional(),
          globalMarkupPercent: z.number().optional(),
          validToDate: z.date().optional(),
        })
      )
      .mutation(({ input }) =>
        createCustomerQuote(
          input.projectId,
          input.quoteNumber,
          input.versionNumber,
          input.salespersonId,
          input.customerPoNumber,
          input.jobTitle,
          input.globalMarkupPercent,
          input.validToDate
        )
      ),
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => getCustomerQuotesByProject(input.projectId)),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCustomerQuoteById(input.id)),
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["draft", "sent", "accepted", "won", "lost"]),
        })
      )
      .mutation(({ input }) => updateCustomerQuoteStatus(input.id, input.status)),
  }),

  // Customer Quote Line Items
  customerQuoteLineItems: router({
    create: protectedProcedure
      .input(
        z.object({
          customerQuoteId: z.number(),
          lineItemId: z.number(),
          quantity: z.number(),
          description: z.string(),
          costPrice: z.union([z.string(), z.number()]),
          markupPercent: z.number(),
          lineOrder: z.number(),
        })
      )
      .mutation(({ input }) =>
        createCustomerQuoteLineItem(
          input.customerQuoteId,
          input.lineItemId,
          input.quantity,
          input.description,
          input.costPrice,
          input.markupPercent,
          input.lineOrder
        )
      ),
    getByCustomerQuote: protectedProcedure
      .input(z.object({ customerQuoteId: z.number() }))
      .query(({ input }) => getCustomerQuoteLineItems(input.customerQuoteId)),
  }),
});

export type AppRouter = typeof appRouter;
