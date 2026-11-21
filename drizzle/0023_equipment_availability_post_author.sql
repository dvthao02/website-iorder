CREATE TYPE "public"."equipment_availability" AS ENUM('in_stock', 'limited', 'pre_order', 'out_of_stock', 'discontinued');--> statement-breakpoint
ALTER TABLE "sales_equipment" ADD COLUMN "availability" "equipment_availability" DEFAULT 'in_stock' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "author_name" varchar(120);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "author_title" varchar(120);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "author_url" text;