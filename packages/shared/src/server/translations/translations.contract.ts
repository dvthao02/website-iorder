import { z } from "zod";

import { translationLocaleCodes, type TranslationLocale } from "./locales";
import { translationGroupIds } from "./translations.groups";

const count = z.number().int().nonnegative();
const localeSchema = z.enum(translationLocaleCodes as [TranslationLocale, ...TranslationLocale[]]);
const groupIdSchema = z.enum(translationGroupIds);
const localeInfo = { code: localeSchema, name: z.string(), label: z.string() };

/** Tổng quan bản dịch: số câu tiếng Việt cần dịch và mỗi ngôn ngữ đã dịch được bao nhiêu. */
export const translationOverviewSchema = z.object({
  /** Phiên bản danh sách ngôn ngữ đã thêm; gửi lại khi thêm hoặc gỡ ngôn ngữ để phát hiện người khác vừa đổi. */
  version: z.number().int().nonnegative(),
  /** Ngôn ngữ trong danh mục mà website chưa thêm (để người vận hành chọn thêm). */
  available: z.array(z.object(localeInfo)),
  /** Số câu tiếng Việt cần dịch trong nội dung đang công khai. */
  total: count,
  /** Trong đó số chữ cố định của giao diện website (phần còn lại là nội dung CMS). */
  uiTotal: count,
  /** Các vùng của website có chữ cần dịch (chỉ vùng có ít nhất một câu), kèm số câu. Một câu dùng ở nhiều vùng được tính ở mỗi vùng. */
  groups: z.array(z.object({ id: groupIdSchema, label: z.string(), total: count })),
  locales: z.array(z.object({
    ...localeInfo,
    translated: count,
    /** Trong số đã dịch, số chữ cố định của giao diện. */
    uiTranslated: count,
    /** Câu đang dùng trên website nhưng chưa có bản dịch. */
    missing: count,
    /** Bản dịch đã lưu nhưng câu gốc không còn trên website (câu gốc đã sửa hoặc xóa). */
    unused: count,
    /** Số câu chưa dịch theo từng vùng (khóa là mã vùng). */
    missingByGroup: z.record(z.string(), count),
    /** Trong số câu chưa dịch, số câu có gợi ý sẵn từ câu giống đã dịch (chỉ khác hoa/thường hoặc dấu câu cuối, hoặc trùng chữ giao diện). */
    suggestible: count,
  })),
});
export type TranslationOverview = z.infer<typeof translationOverviewSchema>;

/** Thêm hoặc gỡ ngôn ngữ: toàn bộ danh sách ngôn ngữ mong muốn (theo mã) và version đã đọc. */
export const translationLocalesUpdateSchema = z.object({ locales: z.array(localeSchema).max(translationLocaleCodes.length), expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();

/** Các dòng cần xuất: `all` mọi câu đang dùng trên website (kèm bản dịch đã có); `missing` chỉ các câu chưa có bản dịch. */
export const translationExportScopeSchema = z.enum(["all", "missing"]);
export type TranslationExportScope = z.infer<typeof translationExportScopeSchema>;

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
