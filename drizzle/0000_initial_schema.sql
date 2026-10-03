CREATE TYPE "public"."content_status" AS ENUM('draft', 'review', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."offering_type" AS ENUM('software', 'solution', 'service', 'industry');--> statement-breakpoint
CREATE TYPE "public"."partner_kind" AS ENUM('partner', 'customer');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('news', 'promotion', 'case_study', 'announcement', 'guide');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_hash" varchar(128),
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(80) NOT NULL,
	"email" varchar(320),
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(180) NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" uuid,
	"storage_key" varchar(500) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"file_size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"alt_text" varchar(500),
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "equipment_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"description" text,
	"cover_media_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offering_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"editor_id" uuid,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cover_media_id" uuid,
	"type" "offering_type" NOT NULL,
	"title" varchar(220) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"summary" text,
	"content" jsonb NOT NULL,
	"icon" varchar(120),
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"draft_version" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"seo_title" varchar(70),
	"seo_description" varchar(180),
	"canonical_url" text,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" varchar(220) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"model_code" varchar(80),
	"cover_media_id" uuid,
	"price_vnd" bigint NOT NULL,
	"warranty_months" integer DEFAULT 12 NOT NULL,
	"summary" text,
	"specification_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"draft_version" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"seo_title" varchar(70),
	"seo_description" varchar(180),
	"canonical_url" text,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_equipment_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_equipment_id" uuid NOT NULL,
	"editor_id" uuid,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"type" varchar(80) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"appearance" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"editor_id" uuid,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_note" varchar(500),
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(220) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"template" varchar(80) DEFAULT 'default' NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"draft_version" integer DEFAULT 0 NOT NULL,
	"seo_title" varchar(70),
	"seo_description" varchar(180),
	"canonical_url" text,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" varchar(160) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_categories" (
	"post_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "post_categories_post_id_category_id_pk" PRIMARY KEY("post_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "post_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"editor_id" uuid,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "post_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid,
	"cover_media_id" uuid,
	"type" "post_type" NOT NULL,
	"title" varchar(220) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"excerpt" text,
	"content" jsonb NOT NULL,
	"content_html" text,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"draft_version" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"seo_title" varchar(70),
	"seo_description" varchar(180),
	"canonical_url" text,
	"promotion_start_at" timestamp with time zone,
	"promotion_end_at" timestamp with time zone,
	"cta_label" varchar(80),
	"cta_url" text,
	"badge_text" varchar(60),
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(120) NOT NULL,
	"entity_id" uuid,
	"before_data" jsonb,
	"after_data" jsonb,
	"ip_hash" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_id" uuid NOT NULL,
	"parent_id" uuid,
	"label" varchar(180) NOT NULL,
	"url" text NOT NULL,
	"target" varchar(20) DEFAULT '_self' NOT NULL,
	"icon" varchar(120),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"location" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" varchar(500) NOT NULL,
	"destination_path" varchar(1000) NOT NULL,
	"status_code" integer DEFAULT 301 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_key" varchar(40) DEFAULT 'default' NOT NULL,
	"company_name" varchar(220) NOT NULL,
	"legal_name" varchar(220),
	"hotline" varchar(60),
	"support_email" varchar(320),
	"sales_email" varchar(320),
	"address" text,
	"working_hours" varchar(255),
	"logo_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(160) NOT NULL,
	"value" jsonb NOT NULL,
	"description" varchar(500),
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"email" varchar(320),
	"business_model" varchar(120),
	"branches" varchar(60),
	"need" varchar(200),
	"message" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"ip_hash" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	"handled_by" uuid
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logo_media_id" uuid,
	"kind" "partner_kind" DEFAULT 'partner' NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"website_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_media_id" uuid,
	"icon" varchar(60) NOT NULL,
	"title" varchar(220) NOT NULL,
	"description" text,
	"meta" varchar(160),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avatar_media_id" uuid,
	"author_name" varchar(180) NOT NULL,
	"author_role" varchar(180),
	"company" varchar(180),
	"quote" text NOT NULL,
	"rating" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_groups" ADD CONSTRAINT "equipment_groups_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_revisions" ADD CONSTRAINT "offering_revisions_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_revisions" ADD CONSTRAINT "offering_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_equipment" ADD CONSTRAINT "sales_equipment_group_id_equipment_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."equipment_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_equipment" ADD CONSTRAINT "sales_equipment_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_equipment_revisions" ADD CONSTRAINT "sales_equipment_revisions_sales_equipment_id_sales_equipment_id_fk" FOREIGN KEY ("sales_equipment_id") REFERENCES "public"."sales_equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_equipment_revisions" ADD CONSTRAINT "sales_equipment_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_blocks" ADD CONSTRAINT "page_blocks_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_parent_id_menu_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_profile" ADD CONSTRAINT "site_profile_logo_media_id_media_assets_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_leads" ADD CONSTRAINT "contact_leads_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_media_id_media_assets_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_downloads" ADD CONSTRAINT "support_downloads_file_media_id_media_assets_id_fk" FOREIGN KEY ("file_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_avatar_media_id_media_assets_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_unique" ON "roles" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_expires_at_index" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_index" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_status_index" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_assets_mime_type_index" ON "media_assets" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX "media_assets_created_at_index" ON "media_assets" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_groups_active_slug_unique" ON "equipment_groups" USING btree ("slug") WHERE "equipment_groups"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "equipment_groups_enabled_sort_index" ON "equipment_groups" USING btree ("is_enabled","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "offering_revisions_version_unique" ON "offering_revisions" USING btree ("offering_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "offerings_active_type_slug_unique" ON "offerings" USING btree ("type","slug") WHERE "offerings"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "offerings_type_status_sort_index" ON "offerings" USING btree ("type","status","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_equipment_active_slug_unique" ON "sales_equipment" USING btree ("slug") WHERE "sales_equipment"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sales_equipment_group_status_sort_index" ON "sales_equipment" USING btree ("group_id","status","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_equipment_revisions_version_unique" ON "sales_equipment_revisions" USING btree ("sales_equipment_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "page_blocks_position_unique" ON "page_blocks" USING btree ("page_id","sort_order");--> statement-breakpoint
CREATE INDEX "page_blocks_page_enabled_index" ON "page_blocks" USING btree ("page_id","is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "page_revisions_version_unique" ON "page_revisions" USING btree ("page_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_active_slug_unique" ON "pages" USING btree ("slug") WHERE "pages"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "pages_status_published_at_index" ON "pages" USING btree ("status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "post_revisions_version_unique" ON "post_revisions" USING btree ("post_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_active_slug_unique" ON "posts" USING btree ("slug") WHERE "posts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "posts_status_published_at_index" ON "posts" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "posts_type_status_index" ON "posts" USING btree ("type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_unique" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_index" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_at_index" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_position_unique" ON "menu_items" USING btree ("menu_id","parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "menu_items_menu_enabled_index" ON "menu_items" USING btree ("menu_id","is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "menus_location_unique" ON "menus" USING btree ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "redirects_source_path_unique" ON "redirects" USING btree ("source_path");--> statement-breakpoint
CREATE INDEX "redirects_enabled_index" ON "redirects" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "site_profile_key_unique" ON "site_profile" USING btree ("profile_key");--> statement-breakpoint
CREATE UNIQUE INDEX "site_settings_key_unique" ON "site_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "contact_leads_status_created_index" ON "contact_leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "contact_leads_created_index" ON "contact_leads" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_name_unique" ON "partners" USING btree ("name");--> statement-breakpoint
CREATE INDEX "partners_enabled_sort_index" ON "partners" USING btree ("is_enabled","sort_order");--> statement-breakpoint
CREATE INDEX "support_downloads_enabled_sort_index" ON "support_downloads" USING btree ("is_enabled","sort_order");--> statement-breakpoint
CREATE INDEX "testimonials_enabled_sort_index" ON "testimonials" USING btree ("is_enabled","sort_order");