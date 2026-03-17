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
- [x] Add project_suppliers junction table to track expected suppliers per project
- [x] Add backend procedures: add supplier to project, remove supplier from project, list project suppliers
- [x] Auto-detect "pricing received" status by checking if a supplier quote exists for that supplier+project
- [x] Build supplier tracking UI section in ProjectDetailPage with add/remove and tick/untick indicators
- [x] Show visual tick (green) for suppliers with uploaded pricing, unticked (amber) for those still pending
- [x] Improve AI extraction prompt to handle Raylinc, Luxson, and Clevertronics formats
- [x] Handle items with no unit price (Raylinc bundled items) — extract as $0 or flag
- [x] Handle space-separated numbers (Luxson format: 5 393.29)
- [x] Extract section/type groupings (TYPE W2, PL1, 1S, 2S, etc.) into a type/group field
- [x] Extract per-item comments/notes (Clevertronics Comments column)
- [x] Extract quote expiry/validity date when available
- [x] Handle zero-quantity items (Clevertronics optional items)
- [x] Distinguish section headers from actual line items
- [x] Extract lead times from both per-item and document-level notes
- [x] Improve number parsing robustness (commas, spaces, currency symbols)
- [x] Better error handling and user feedback for extraction failures
- [x] Auto-add tracked supplier when a quote PDF is uploaded for a project
- [x] Add Type number column to customer quote line items schema
- [x] Show Type column in quote builder selection table
- [x] Pass Type through when creating customer quote line items
- [x] Show Type column in customer quote preview
- [x] Add Type column to generated customer quote PDF
- [x] Fix extraction to capture ALL descriptive info from supplier quotes, not just priced line items
- [x] Include LED strip run lengths, PSU details, converter specs, finish notes in descriptions
- [x] Items without qty/price should still be captured as descriptive detail under their Type
- [x] Preserve supplier notes like "Finish to be confirmed", "Quoted as per Section drawing"
- [x] Fix typeNotes to only show on first item per type group (no repeating)
- [x] Build collapsible type groups in supplier quote card (summary row with bundled total, expand for detail)
- [x] Build collapsible type groups in quote builder (same pattern)
- [x] Update customer quote PDF to group items by Type with summary header rows and type totals
- [x] Add backend procedure to delete a supplier quote (cascade delete line items)
- [x] Add delete button with confirmation dialog to supplier quote cards in ProjectDetailPage
- [x] Only group types with 3+ items (1-2 items show flat, no collapsible group)
- [x] Remove quantity from group summary rows (mixed items like clips shouldn't be summed)
- [x] Show only total price on group header rows (no qty column)
- [x] Auto-populate quote builder special instructions/notes with delivery notes extracted from supplier quotes
- [x] Add drag-to-reorder line items in quote builder to control sequence on customer quote
- [x] Add editable quantity field in quote builder so user can override supplier-quoted quantities
- [x] Ensure reordered sequence is preserved when generating customer quote PDF
- [x] Improve quote builder UX: make editable Qty and drag-to-reorder more discoverable
- [x] Move Qty editing into the main selection table (not hidden behind horizontal scroll)
- [x] Make reorder section more prominent or integrate it into the main flow
- [x] Fix: "Rendered more hooks than during previous render" error on Step 2 of quote builder
- [x] Fix: Trash2 is not defined error in ProjectDetailPage
- [x] Audit and identify duplicate suppliers in the database
- [x] Merge duplicate suppliers: consolidate quotes, line items, and project_suppliers into one canonical supplier
- [x] Improve supplier name matching logic to prevent future duplicates (fuzzy/normalised matching)
- [x] Add supplier edit/delete functionality on the Suppliers page
- [x] Add backend procedure to update supplier details (name, contact, email, phone, default margin)
- [x] Add backend procedure to delete a supplier (with cascade check for existing quotes)
- [x] Add edit dialog/inline editing on Suppliers page
- [x] Add delete button with confirmation dialog on Suppliers page
- [x] Replace slow drag-to-reorder in Step 2 with fast numbered sequence inputs
- [x] Add quick actions: Move to Top, Move Up, Move Down, Move to Bottom
- [x] Allow typing a sequence number to instantly reposition a line
- [x] Customer schedule import: backend API endpoint to extract type codes from customer tender PDFs/images using AI
- [x] Customer schedule import: frontend UI with Import Schedule button and extracted type preview badges
- [x] Customer schedule import: auto-sort logic with fuzzy type code matching (normalises TYPE prefix, handles partial matches)
- [x] Customer schedule import: 16 unit tests for normalisation, fuzzy matching, and auto-sort logic
- [x] Customer schedule import: add Excel (.xlsx/.xls) and CSV file support
- [x] Customer schedule import: server-side spreadsheet parsing to extract type codes from rows/columns
- [x] Customer schedule import: update frontend file picker to accept spreadsheet formats
- [x] Make quote builder dialog wider (near full-screen) to reduce horizontal scrolling
- [x] Global margin field should instantly apply to ALL lines without needing select-all first
- [x] Allow selecting specific lines to change their margin independently after global is set
- [x] Fix auto-sort: bundled items should stay with their type group in correct position, not pushed to end
- [x] Highlight quantity mismatches between customer schedule and supplier quotes in Step 2 review table
- [x] Fix PDF generation: bundled items should appear in the user's chosen order, not pushed to end of quote
- [x] Add 'archived' status to project schema
- [x] Add archive/unarchive DB helpers and tRPC procedures
- [x] Add Archived Projects tab to frontend UI with restore capability
- [x] Filter archived projects out of main Projects tab
- [x] Archive all existing projects so user starts fresh
- [x] Update dashboard stats to exclude archived projects
- [x] Add 'isArchived' flag to supplier schema
- [x] Add archive/unarchive DB helpers and tRPC procedures for suppliers
- [x] Add tabbed Active/Archived UI to SuppliersPage with archive/restore actions
- [x] Filter archived suppliers from active supplier lists (dropdowns, project assignment, etc.)
- [x] Add company branding fields to Settings: company name, ABN, address, phone, email
- [x] Add logo upload to Settings for PDF header
- [x] Add PDF color scheme picker to Settings
- [x] Update PDF generation to use company settings for header (name, ABN, address, logo)
- [x] Update PDF generation to use custom color scheme
- [x] Fix: Settings page save reverts to old values instead of persisting changes
- [x] Fix: PDF pages not utilizing full page length, too much wasted space at bottom of each page
- [x] Fix: Company settings (address, phone, ABN) revert to defaults after saving
- [x] Fix: Settings keep reverting to old values after saving (recurring issue)
- [x] Set up site password protection (password: 880) for staff access
- [x] Fix: Password protection not prompting when loading site in new tab (wired PasswordGate into App.tsx)
- [x] Add delete option for customer quotes within each project to remove duplicates
- [x] Fix: Published site PDF shows default blue colors and missing company info instead of saved settings (made settings global, not per-user)
- [x] Make all data shared across all password-auth users (projects, quotes, suppliers, salespersons, settings)
- [x] Analytics tab: backend queries for quotes per customer, win rates, total dollar values
- [x] Analytics tab: overall KPI cards (total quotes, won quotes, total revenue, win rate)
- [x] Analytics tab: per-customer breakdown table with quote count, win count, win rate, total value
- [x] Analytics tab: visual charts (bar chart, pie chart, trend over time)
- [x] Analytics tab: add to sidebar navigation
- [x] Analytics tab: all data tracked globally across all users
- [x] Clean up test/archived data from database so analytics only shows real quotes
- [x] Fix analytics queries to exclude archived projects from counts
- [x] Clean up duplicate salespersons (53 test John Smiths removed)
- [x] Archive test suppliers (TrackSup-*, Test Supplier No Markup) and duplicate Everlite/Luxson entries
- [x] Fix company settings with correct MM Albion details (address, phone, fax, email)
- [x] Fix AI extraction price misalignment: prices assigned to wrong line items when no-price items sit between priced items (e.g., Lumen8 WL05 type — bronze pipe price wrongly assigned to LED module)
- [x] Add Lumen8 Architectural Lighting format instructions to AI extraction prompt
- [x] Fix existing Lumen8 data: WL02, WL05 LED modules now bundled, bronze pipes now priced; SL04, SL05 shades now bundled, drivers now priced
- [x] Add general CRITICAL PRICE ALIGNMENT rule to prevent price shifting across rows for all suppliers
- [x] Add manual line item entry to supplier quotes (add individual items by hand)
- [x] Add text paste + AI extraction for email quotes (paste email text, AI extracts line items)
- [x] Backend: API endpoint to extract line items from pasted text using AI
- [x] Frontend: "Add Line Item" button on supplier quote cards with inline form
- [x] Frontend: "Paste Email Quote" card with text area and AI extraction
- [x] Frontend: "Manual Entry" card to create supplier quote and add items by hand
- [x] Fix test cleanup: tests now clean up after themselves (no more test data pollution in production DB)
- [x] Add supplier name input field to Paste Email Quote section (required field)
- [x] Pass supplier name to backend when extracting email quotes (overrides AI-detected name)
- [x] Add editable Type field to every line item in the customer quote builder (Step 1 and Step 2)
- [x] Ensure every line must have a Type before generating customer quote (validation with error message)
- [x] Red highlight on empty Type fields to guide user
- [x] Type is editable in both Step 1 (selection table) and Step 2 (review/reorder table)
- [x] Add visual separation between type groups in customer quote PDF (top/bottom accent borders, left accent bar on grouped items, spacing between groups)
- [x] Fix analytics: quote count now shows 4 (latest version per project, not all versions)
- [x] Fix analytics: projects won tracking now uses project status instead of quote status
- [x] Fix analytics: all three functions (overview, byCustomer, timeline) now use latest-quote-per-project and project-status-based won/lost
