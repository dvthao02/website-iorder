CREATE TABLE "post_authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(140) NOT NULL,
	"name" varchar(120) NOT NULL,
	"job_title" varchar(120),
	"bio" text,
	"avatar_media_id" uuid,
	"profile_url" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "author_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_avatar_media_id_media_assets_id_fk" FOREIGN KEY ("avatar_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_authors_slug_unique" ON "post_authors" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_profile_id_post_authors_id_fk" FOREIGN KEY ("author_profile_id") REFERENCES "public"."post_authors"("id") ON DELETE set null ON UPDATE no action;