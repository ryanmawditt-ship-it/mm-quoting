ALTER TABLE `line_items` ADD `comments` text;--> statement-breakpoint
ALTER TABLE `line_items` ADD `totalPrice` decimal(12,4);--> statement-breakpoint
ALTER TABLE `line_items` ADD `isBundled` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `supplier_quotes` ADD `quoteExpiry` timestamp;--> statement-breakpoint
ALTER TABLE `supplier_quotes` ADD `validityDays` int;--> statement-breakpoint
ALTER TABLE `supplier_quotes` ADD `deliveryNotes` text;