ALTER TABLE "contact_leads" ADD COLUMN "phone_digits" varchar(20);--> statement-breakpoint
ALTER TABLE "contact_leads" ADD COLUMN "context" jsonb;--> statement-breakpoint
CREATE INDEX "contact_leads_phone_created_index" ON "contact_leads" USING btree ("phone_digits","created_at");
--> statement-breakpoint
-- Liên hệ đã có: điền số điện thoại dạng chữ số (cùng quy tắc với normalizePhone trong leads.guard.ts: bỏ ký tự không phải số, đầu 84 thành 0).
UPDATE "contact_leads" SET "phone_digits" = CASE WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^84[0-9]{9,}$' THEN '0' || substr(regexp_replace("phone", '[^0-9]', '', 'g'), 3) ELSE regexp_replace("phone", '[^0-9]', '', 'g') END WHERE "phone_digits" IS NULL;
