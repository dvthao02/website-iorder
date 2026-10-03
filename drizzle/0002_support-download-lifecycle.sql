CREATE TABLE "support_download_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"support_download_id" uuid NOT NULL,
	"editor_id" uuid,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_downloads" ADD COLUMN "draft_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "support_downloads" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_download_revisions" ADD CONSTRAINT "support_download_revisions_support_download_id_support_downloads_id_fk" FOREIGN KEY ("support_download_id") REFERENCES "public"."support_downloads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_download_revisions" ADD CONSTRAINT "support_download_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "support_download_revisions_version_unique" ON "support_download_revisions" USING btree ("support_download_id","version_number");