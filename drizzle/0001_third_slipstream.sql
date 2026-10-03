CREATE TABLE "menu_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_id" uuid NOT NULL,
	"editor_id" uuid,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_revisions" ADD CONSTRAINT "menu_revisions_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_revisions" ADD CONSTRAINT "menu_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "menu_revisions_version_unique" ON "menu_revisions" USING btree ("menu_id","version_number");