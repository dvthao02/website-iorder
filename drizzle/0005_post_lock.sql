ALTER TABLE "posts" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "locked_by" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_locked_by_index" ON "posts" USING btree ("locked_by");