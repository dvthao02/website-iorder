CREATE TABLE "builder_previews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"document_id" uuid,
	"sequence" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"parent_origin" varchar(500) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offerings" ADD COLUMN "seo" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "seo" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "seo" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "builder_previews" ADD CONSTRAINT "builder_previews_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "builder_previews_expiry_index" ON "builder_previews" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "builder_previews_owner_index" ON "builder_previews" USING btree ("owner_id");