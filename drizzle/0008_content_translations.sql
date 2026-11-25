CREATE TABLE "content_translations" (
	"locale" varchar(12) NOT NULL,
	"source_key" varchar(32) NOT NULL,
	"source_text" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_translations_locale_source_key_pk" PRIMARY KEY("locale","source_key")
);
