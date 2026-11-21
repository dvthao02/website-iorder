CREATE TABLE "login_throttle_buckets" (
	"scope" varchar(16) NOT NULL,
	"key_hash" varchar(128) NOT NULL,
	"attempts" integer NOT NULL,
	"window_expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_throttle_buckets_scope_key_hash_pk" PRIMARY KEY("scope","key_hash")
);
--> statement-breakpoint
CREATE INDEX "login_throttle_buckets_window_expires_at_index" ON "login_throttle_buckets" USING btree ("window_expires_at");