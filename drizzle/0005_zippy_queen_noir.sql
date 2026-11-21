CREATE INDEX "categories_parent_sort_index" ON "categories" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "post_categories_category_post_index" ON "post_categories" USING btree ("category_id","post_id");--> statement-breakpoint
CREATE INDEX "post_tags_tag_post_index" ON "post_tags" USING btree ("tag_id","post_id");