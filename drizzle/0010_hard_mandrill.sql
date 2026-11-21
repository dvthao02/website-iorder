ALTER TABLE "roles" ADD COLUMN "description" varchar(500);--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "roles" SET "is_system" = true WHERE "code" = 'admin';