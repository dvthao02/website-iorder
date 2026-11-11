ALTER TABLE "sales_equipment" ADD COLUMN "seo" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_equipment" ADD COLUMN "blocks" jsonb;