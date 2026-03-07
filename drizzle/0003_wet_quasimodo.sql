CREATE TABLE `project_suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`supplierId` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `project_suppliers` ADD CONSTRAINT `project_suppliers_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_suppliers` ADD CONSTRAINT `project_suppliers_supplierId_suppliers_id_fk` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;