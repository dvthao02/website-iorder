CREATE TYPE "public"."admin_notification_state" AS ENUM('read', 'dismissed');--> statement-breakpoint
CREATE TABLE "admin_notification_states" (
	"user_id" uuid NOT NULL,
	"notification_key" varchar(160) NOT NULL,
	"fingerprint" varchar(160) NOT NULL,
	"state" "admin_notification_state" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_notification_states_user_id_notification_key_pk" PRIMARY KEY("user_id","notification_key")
);
--> statement-breakpoint
ALTER TABLE "admin_notification_states" ADD CONSTRAINT "admin_notification_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_notification_states_updated_at_index" ON "admin_notification_states" USING btree ("updated_at");