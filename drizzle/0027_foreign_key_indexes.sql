CREATE INDEX "role_permissions_permission_id_index" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_index" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "users_avatar_media_id_index" ON "users" USING btree ("avatar_media_id");--> statement-breakpoint
CREATE INDEX "equipment_groups_cover_media_id_index" ON "equipment_groups" USING btree ("cover_media_id");--> statement-breakpoint
CREATE INDEX "offerings_cover_media_id_index" ON "offerings" USING btree ("cover_media_id");--> statement-breakpoint
CREATE INDEX "sales_equipment_cover_media_id_index" ON "sales_equipment" USING btree ("cover_media_id");--> statement-breakpoint
CREATE INDEX "post_authors_avatar_media_id_index" ON "post_authors" USING btree ("avatar_media_id");--> statement-breakpoint
CREATE INDEX "posts_cover_media_id_index" ON "posts" USING btree ("cover_media_id");--> statement-breakpoint
CREATE INDEX "posts_author_id_index" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "posts_author_profile_id_index" ON "posts" USING btree ("author_profile_id");--> statement-breakpoint
CREATE INDEX "menu_items_parent_id_index" ON "menu_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "contact_leads_handled_by_index" ON "contact_leads" USING btree ("handled_by");--> statement-breakpoint
CREATE INDEX "partners_logo_media_id_index" ON "partners" USING btree ("logo_media_id");--> statement-breakpoint
CREATE INDEX "support_downloads_file_media_id_index" ON "support_downloads" USING btree ("file_media_id");--> statement-breakpoint
CREATE INDEX "testimonials_avatar_media_id_index" ON "testimonials" USING btree ("avatar_media_id");