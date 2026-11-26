CREATE TABLE "error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"error_name" varchar(160),
	"error_message" text,
	"method" varchar(12),
	"path" varchar(400),
	"request_id" varchar(128),
	"details" jsonb NOT NULL,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "error_logs_fingerprint_unique" ON "error_logs" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "error_logs_last_seen_at_index" ON "error_logs" USING btree ("last_seen_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);