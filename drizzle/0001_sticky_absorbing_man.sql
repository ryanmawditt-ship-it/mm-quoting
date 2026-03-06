CREATE TABLE `company_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`abn` varchar(20),
	`address` text,
	`phone` varchar(20),
	`fax` varchar(20),
	`email` varchar(255),
	`logoUrl` text,
	`standardTerms` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_quote_line_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerQuoteId` int NOT NULL,
	`lineItemId` int NOT NULL,
	`quantity` int NOT NULL,
	`description` text,
	`costPrice` decimal(12,4) NOT NULL,
	`markupPercent` int NOT NULL,
	`sellPrice` decimal(12,4) NOT NULL,
	`lineOrder` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_quote_line_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`quoteNumber` varchar(50) NOT NULL,
	`versionNumber` int NOT NULL DEFAULT 0,
	`salespersonId` int,
	`customerPoNumber` varchar(100),
	`jobTitle` varchar(255),
	`globalMarkupPercent` int,
	`validFromDate` timestamp NOT NULL DEFAULT (now()),
	`validToDate` timestamp NOT NULL,
	`status` enum('draft','sent','accepted','won','lost') NOT NULL DEFAULT 'draft',
	`pdfUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `line_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierQuoteId` int NOT NULL,
	`itemNumber` int,
	`type` varchar(100),
	`productCode` varchar(255) NOT NULL,
	`description` text,
	`quantity` int NOT NULL,
	`unitOfMeasure` varchar(50) DEFAULT 'EA',
	`costPrice` decimal(12,4) NOT NULL,
	`leadTimeDays` int,
	`markupPercent` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `line_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerContact` varchar(255),
	`customerEmail` varchar(255),
	`customerAddress` text,
	`status` enum('active','won','lost','follow_up_needed') NOT NULL DEFAULT 'active',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salespersons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `salespersons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`supplierId` int NOT NULL,
	`quoteNumber` varchar(100),
	`quoteDate` timestamp,
	`pdfUrl` text,
	`extractedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplier_quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`contact` varchar(255),
	`email` varchar(255),
	`phone` varchar(20),
	`defaultMarkupPercent` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `company_settings` ADD CONSTRAINT `company_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_quote_line_items` ADD CONSTRAINT `customer_quote_line_items_customerQuoteId_customer_quotes_id_fk` FOREIGN KEY (`customerQuoteId`) REFERENCES `customer_quotes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_quote_line_items` ADD CONSTRAINT `customer_quote_line_items_lineItemId_line_items_id_fk` FOREIGN KEY (`lineItemId`) REFERENCES `line_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_quotes` ADD CONSTRAINT `customer_quotes_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_quotes` ADD CONSTRAINT `customer_quotes_salespersonId_salespersons_id_fk` FOREIGN KEY (`salespersonId`) REFERENCES `salespersons`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `line_items` ADD CONSTRAINT `line_items_supplierQuoteId_supplier_quotes_id_fk` FOREIGN KEY (`supplierQuoteId`) REFERENCES `supplier_quotes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salespersons` ADD CONSTRAINT `salespersons_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_quotes` ADD CONSTRAINT `supplier_quotes_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier_quotes` ADD CONSTRAINT `supplier_quotes_supplierId_suppliers_id_fk` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;