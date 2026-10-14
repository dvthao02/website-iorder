ALTER TABLE "menu_items" ADD COLUMN "link_type" varchar(32) DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "content_id" uuid;--> statement-breakpoint
CREATE INDEX "menu_items_content_reference_index" ON "menu_items" USING btree ("link_type","content_id");