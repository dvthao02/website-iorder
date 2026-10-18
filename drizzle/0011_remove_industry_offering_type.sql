-- Bỏ loại offering "industry" (ngành nghề). Nếu còn dòng type = 'industry' thì lệnh chuyển kiểu cuối
-- sẽ lỗi và migration hoàn tác: chuyển/xóa các dòng đó trước khi chạy lại.
ALTER TABLE "offerings" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."offering_type";--> statement-breakpoint
CREATE TYPE "public"."offering_type" AS ENUM('software', 'solution', 'service');--> statement-breakpoint
ALTER TABLE "offerings" ALTER COLUMN "type" SET DATA TYPE "public"."offering_type" USING "type"::"public"."offering_type";