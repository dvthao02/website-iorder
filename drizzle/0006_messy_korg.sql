ALTER TABLE "post_categories" DROP CONSTRAINT "post_categories_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "post_tags" DROP CONSTRAINT "post_tags_tag_id_tags_id_fk";
--> statement-breakpoint
DROP INDEX "redirects_source_path_unique";--> statement-breakpoint
DROP INDEX "partners_name_unique";--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "redirects" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_downloads" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_deleted_at_index" ON "media_assets" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "redirects_deleted_at_index" ON "redirects" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "partners_deleted_at_index" ON "partners" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "support_downloads_deleted_at_index" ON "support_downloads" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "testimonials_deleted_at_index" ON "testimonials" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "redirects_source_path_unique" ON "redirects" USING btree ("source_path") WHERE "redirects"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "partners_name_unique" ON "partners" USING btree ("name") WHERE "partners"."deleted_at" is null;