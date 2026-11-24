ALTER TABLE "contact_leads" ADD COLUMN "assigned_to" uuid;--> statement-breakpoint
ALTER TABLE "contact_leads" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact_leads" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact_leads" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "contact_leads" ADD CONSTRAINT "contact_leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_leads" ADD CONSTRAINT "contact_leads_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_leads_assigned_to_index" ON "contact_leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "contact_leads_deleted_by_index" ON "contact_leads" USING btree ("deleted_by");