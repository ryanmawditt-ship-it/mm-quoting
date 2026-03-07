# MM Quoting System - Project TODO

## Core Features

### Phase 1: Database & Backend Infrastructure
- [x] Design and implement database schema (projects, suppliers, quotes, line items, company settings)
- [x] Create backend procedures for CRUD operations on projects
- [x] Create backend procedures for CRUD operations on suppliers
- [x] Create backend procedures for CRUD operations on quotes and line items
- [x] Implement markup calculation logic (per-supplier, per-line-item, global)
- [x] Implement GST calculation (10% per line and totals)
- [x] Create backend procedures for company settings management
- [x] Write vitest tests for core business logic (markup, GST calculations)

### Phase 2: Company Settings & Configuration
- [x] Build company settings page (name, ABN, address, phone, fax, standard terms)
- [x] Implement logo upload via URL storage
- [x] Build salesperson management (add names)
- [x] Create UI for managing company details with form validation
- [x] Test company settings persistence and retrieval

### Phase 3: Project/Tender Dashboard
- [x] Build project list view with status indicators (active, won, follow-up needed)
- [x] Implement project creation form (name, customer, contact, status)
- [x] Build project detail view with tabs for supplier/customer quotes
- [x] Implement win rate analytics calculation
- [ ] Add follow-up reminder system
- [x] Create project status update functionality
- [x] Build search and filter for projects

### Phase 4: Supplier Management
- [x] Build supplier list view
- [x] Implement supplier creation form (name, contact, default markup %)
- [x] Implement default markup percentage application
- [ ] Build supplier edit/delete functionality

### Phase 5: Supplier Quote PDF Upload & Extraction
- [x] Build PDF upload UI
- [x] Implement AI vision-based PDF extraction (using LLM with file_url)
- [x] Extract line items: type, product code, description, quantity, unit price, lead time
- [x] Parse and validate extracted data
- [x] Store extracted line items in database linked to project
- [x] Build extraction preview/review UI before confirmation
- [x] Create error handling for failed extractions

### Phase 6: Flexible Markup System
- [x] Build per-supplier markup UI (apply to all items from one supplier)
- [x] Build per-line-item markup UI (individual line item control)
- [x] Build global markup UI (apply to entire quote)
- [x] Implement markup calculation at all three levels
- [x] Create markup preview showing cost vs sell price
- [x] Build UI to switch between markup modes
- [x] Ensure cost prices are never visible to customers in generated PDFs

### Phase 7: Customer Quote Builder
- [x] Build quote builder interface to select/assemble line items
- [x] Implement line item selection (checkbox/multi-select)
- [x] Build real-time price calculation with markup applied
- [x] Create quote preview showing final prices (no cost prices visible)
- [x] Build quote summary with totals (Excl GST, GST, Incl GST)

### Phase 8: PDF Generation
- [x] Design PDF template matching MM Albion's existing quote format
- [x] Implement PDF generation with company header and logo
- [x] Add line items table to PDF (part number, description, qty, unit price, GST, line total)
- [x] Implement GST calculation display in PDF
- [x] Add totals section (Total Excl GST, GST, Total Incl GST)
- [x] Add company footer (terms)
- [x] Create "Download PDF" functionality

### Phase 9: Quote Versioning & Validity Tracking
- [x] Implement auto-incrementing quote number system (e.g., 880-000001-000)
- [x] Build quote revision tracking (version numbers 000, 001, 002, etc.)
- [x] Implement quote validity date setting (Valid To date)
- [x] Create expiry warning display
- [x] Add quote status tracking (draft, sent, accepted, won, lost)

### Phase 10: UI Polish & Testing
- [x] Design and implement consistent navigation/layout (DashboardLayout)
- [x] Implement loading states and error handling
- [x] Add toast notifications for user feedback
- [x] Create empty states for lists
- [x] Write vitest tests (18 tests passing)

### Phase 11: Advanced Features (Optional/Future)
- [ ] Email integration to send quotes directly
- [ ] Quote template library for common projects
- [ ] Bulk quote generation
- [ ] Integration with accounting software
- [ ] Customer portal for quote viewing
- [ ] Quote acceptance/rejection tracking
- [ ] Supplier edit/delete functionality
- [ ] Follow-up reminder system
- [ ] Quote comparison (show changes between versions)

## Critical Constraints
- [x] Customer quotes must NEVER show cost pricing, only marked-up sell prices
- [x] Markup must work at three levels: per-supplier, per-line-item, global
- [x] Automatic extraction from supplier PDFs (no manual typing)
- [x] GST calculation: 10% per line and totals
- [x] Professional PDF output matching MM Albion format
- [x] Quote versioning with auto-incrementing numbers
- [x] Validity date tracking with expiry warnings

## Bugs
- [x] Fix: After signing in, user is redirected back to Home screen instead of the dashboard
- [x] Fix: Sign-in flow completely broken - user cannot authenticate at all
- [x] Remove OAuth sign-in and replace with simple password protection
- [x] Create password login page
- [x] Add server-side password verification endpoint
- [x] Protect all dashboard routes behind password check
- [x] Allow user to set the site password via secrets/env
- [x] Remove all authentication — make site fully open access (no login/password)
- [x] Ensure all tRPC procedures work without requiring a user session
- [x] Ensure API routes work without requiring authentication
- [x] Test PDF scanner end-to-end with real supplier quote (47 items extracted from Everlite quote)
- [x] Test customer quote generation end-to-end
- [x] Fix: File upload doesn't open file picker or support drag-and-drop
- [x] Remove supplier selection from upload — auto-extract supplier info from PDF
- [x] Add proper click-to-browse and drag-and-drop file upload UI
- [x] Change pricing model from markup to margin (Sell = Cost ÷ (1 - margin%))
- [x] Update all UI labels from "markup" to "margin"
- [x] Update backend calculation in apiRoutes.ts (customer quote generation)
- [x] Update frontend calculation in ProjectDetailPage.tsx (quote builder)
- [x] Update supplier default field label from "default markup" to "default margin"
- [x] Update database column comments/labels (conceptual — field names stay same for compatibility)
- [x] Update PDF generation to use margin-based sell prices
- [x] Update vitest tests for margin calculation
- [x] Add persistent margin per line item — save margin to DB so it doesn't reset to 20% on deselect
- [x] Allow individual line item margin editing regardless of margin mode
- [x] Add marginPercent column to supplierQuoteLineItems table (already existed on lineItems)
- [x] Add tRPC procedure to update line item margin
- [x] Load saved margins in quote builder and use them as defaults
- [x] Redesign customer quote PDF — fresh modern professional design (not copying old system)
- [x] Proper pagination for multi-page quotes with repeated table headers
- [x] Clean typography, good whitespace, subtle colour accents
- [x] Professional table layout that works for 4 or 47 line items
- [x] Fix: Product descriptions getting truncated in PDF — must show full descriptions with dynamic row heights
- [x] Update AI extraction to read lead times / delivery times from supplier quotes
- [x] Ensure lead time data is stored and displayed in the quote builder and PDF
- [x] Fix: Supplier quote PDF extraction is failing after recent changes (JSON schema structure was broken)
- [x] Remove per-line GST column from customer PDF — show GST only as a total at the bottom
- [x] Add editable customer details header to quote builder (name, email, address, phone, contact person)
- [x] Pre-fill customer details from project data
- [x] Add special instructions/notes section to quote builder (delivery instructions, additional costs, etc.)
- [x] Include customer details in PDF header (Quote To / Deliver To with copy button)
- [x] Include special instructions/notes on last page of PDF (amber highlighted box)
- [x] Add project status management: Pending, Sent, In Progress, Won, Lost
- [x] Update schema enum to include new statuses (pending, sent, in_progress, won, lost)
- [x] Add status change dropdown/selector on project cards in Projects page
- [x] Add project delete functionality with confirmation dialog
- [x] Cascade delete: remove related supplier quotes, line items, and customer quotes
