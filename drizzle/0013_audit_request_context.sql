ALTER TABLE "audit_logs" ADD COLUMN "ip_address" varchar(64);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" varchar(500);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "request_id" varchar(128);--> statement-breakpoint
CREATE INDEX "audit_logs_ip_address_index" ON "audit_logs" USING btree ("ip_address");