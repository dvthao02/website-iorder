import { z } from "zod";

import { translationLocaleCodes } from "./locales";

const count = z.number().int().nonnegative();
const localeSchema = z.enum(translationLocaleCodes as [string, ...string[]]);

/** Tổng quan bản dịch: số câu tiếng Việt cần dịch và mỗi ngôn ngữ đã dịch được bao nhiêu. */
export const translationOverviewSchema = z.object({
  /** Số câu tiếng Việt cần dịch trong nội dung đang công khai. */
  total: count,
  /** Trong đó số chữ cố định của giao diện website (phần còn lại là nội dung CMS). */
  uiTotal: count,
  locales: z.array(z.object({
    code: localeSchema, name: z.string(), label: z.string(),
    translated: count,
    /** Trong số đã dịch, số chữ cố định của giao diện. */
    uiTranslated: count,
    /** Câu đang dùng trên website nhưng chưa có bản dịch. */
    missing: count,
    /** Bản dịch đã lưu nhưng câu gốc không còn trên website (câu gốc đã sửa hoặc xóa). */
    unused: count,
  })),
});
export type TranslationOverview = z.infer<typeof translationOverviewSchema>;

export const translationImportCountsSchema = z.object({
  /** Câu chưa có bản dịch: sẽ thêm. */
  create: count,
  /** Đã có bản dịch khác và đang bật "cập nhật cả bản dịch đã có": sẽ sửa. */
  update: count,
  /** Đã có đúng bản dịch này. */
  unchanged: count,
  /** Đã có bản dịch khác, giữ nguyên (không bật ghi đè). */
  kept: count,
  /** Ô dịch để trống: bỏ qua. */
  empty: count,
  /** Khóa không còn khớp nội dung hiện tại (câu gốc đã đổi hoặc bị xóa): bỏ qua. */
  stale: count,
  /** Bản dịch dài quá giới hạn, khóa không hợp lệ hoặc trùng khóa trong file: bỏ qua. */
  invalid: count,
});

export const translationImportPlanSchema = z.object({
  locale: localeSchema,
  /** Số dòng dữ liệu trong file. */
  total: count,
  counts: translationImportCountsSchema,
  samples: z.array(z.object({
    key: z.string(), source: z.string(), before: z.string(), after: z.string(),
    status: z.enum(["create", "update", "kept"]),
  })).max(100),
  /** Vấn đề của một số dòng: bỏ qua dòng (thiếu/thừa biến {ten}) hoặc chỉ cảnh báo (bản dịch quá dài); tối đa 30 dòng đầu. */
  problems: z.array(z.object({ key: z.string(), source: z.string(), message: z.string(), skipped: z.boolean() })).max(100),
});
export type TranslationImportPlan = z.infer<typeof translationImportPlanSchema>;

/** Kết quả sau khi áp dụng: `created`/`updated` là số bản dịch đã ghi, các số còn lại như trong kế hoạch xem trước. */
export const translationImportResultSchema = translationImportCountsSchema.omit({ create: true, update: true }).extend({ created: count, updated: count });
export type TranslationImportResult = z.infer<typeof translationImportResultSchema>;
