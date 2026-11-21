import { z } from "zod";

import { externalUrlProblem, maxExternalUrlLength } from "../shared/external-url";

// Link tải về ngoài: https, không tài khoản/mật khẩu (kiểm ở external-url.ts, dùng được cả trên trình duyệt).
const externalUrlSchema = z.string().trim().max(maxExternalUrlLength).superRefine((value, context) => {
  const problem = externalUrlProblem(value);
  if (problem) context.addIssue({ code: "custom", message: problem });
});
// Địa chỉ tải: tệp trong thư viện (/media/…) hoặc link https ngoài.
const downloadUrlSchema = z.string().refine((value) => value.startsWith("/media/") || externalUrlProblem(value) === null, "Địa chỉ tải không hợp lệ.");

export const publicSupportDownloadSchema = z
  .object({
    description: z.string().nullable(),
    downloadUrl: downloadUrlSchema,
    // true: tải từ link ngoài (website mở link ở tab mới), false: tệp trong thư viện của iOrder.
    external: z.boolean(),
    // Nhóm hiển thị (ví dụ "Driver trên Windows"); null = nhóm "Khác".
    groupName: z.string().nullable(),
    icon: z.string(),
    id: z.string().uuid(),
    meta: z.string().nullable(),
    title: z.string(),
  })
  .strict();

// Một mục tải về chỉ có MỘT nguồn: tệp trong thư viện (fileMediaId) hoặc link ngoài (externalUrl).
const supportDownloadFieldsSchema = z
  .object({
    fileMediaId: z.string().uuid().nullable(),
    // Bản lưu cũ (lịch sử phiên bản) chưa có trường này: coi là không có link.
    externalUrl: externalUrlSchema.nullable().default(null),
    // Nhóm hiển thị trên trang Hỗ trợ cài đặt; trống = nhóm "Khác". Bản lưu cũ chưa có trường này: coi là không nhóm.
    groupName: z.string().trim().min(1).max(120).nullable().default(null),
    icon: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(220),
    description: z.string().trim().min(1).max(10_000).nullable(),
    meta: z.string().trim().min(1).max(160).nullable(),
    sortOrder: z.number().int().min(0).max(10_000),
    isEnabled: z.boolean(),
  })
  .strict();

export const adminSupportDownloadInputSchema = supportDownloadFieldsSchema.superRefine((value, context) => {
  if (value.fileMediaId && value.externalUrl) context.addIssue({ code: "custom", path: ["externalUrl"], message: "Chọn một nguồn: tệp trong thư viện hoặc link tải về, không dùng cả hai." });
});

export const adminSupportDownloadSchema = supportDownloadFieldsSchema
  .extend({
    id: z.string().uuid(),
    downloadUrl: downloadUrlSchema.nullable(),
    originalName: z.string().nullable(),
    mimeType: z.string().nullable(),
    draftVersion: z.number().int().nonnegative(),
    archivedAt: z.string().datetime().nullable(),
    status: z.enum(["draft", "published", "archived"]),
  })
  .strict();

export const supportDownloadCreateRequestSchema = z.object({
  values: adminSupportDownloadInputSchema,
  changeNote: z.string().trim().max(500).optional(),
}).strict();

export const supportDownloadMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    values: adminSupportDownloadInputSchema,
    expectedVersion: z.number().int().nonnegative(),
    changeNote: z.string().trim().max(500).optional(),
  }).strict(),
  z.object({ action: z.literal("archive"), expectedVersion: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("restore"), expectedVersion: z.number().int().nonnegative() }).strict(),
]);

export type PublicSupportDownload = z.infer<typeof publicSupportDownloadSchema>;
export type AdminSupportDownload = z.infer<typeof adminSupportDownloadSchema>;
export type AdminSupportDownloadInput = z.infer<typeof adminSupportDownloadInputSchema>;

export const supportDownloadListResponseSchema = z.object({
  downloads: z.array(adminSupportDownloadSchema.extend({
    // The CMS bridge revives *At JSON fields; preserve this contract's ISO string.
    archivedAt: z.preprocess(value => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : value, z.string().datetime().nullable()),
  })).refine(rows => new Set(rows.map(row => row.id)).size === rows.length, "Danh sách tài nguyên có ID trùng."),
});

export function parseSavedSupportDownload(payload: unknown, expected: { id?: string; version: number; status: AdminSupportDownload["status"] }) {
  const parsed = z.object({ download: adminSupportDownloadSchema }).safeParse(payload);
  if (!parsed.success) return undefined;
  const download = parsed.data.download;
  if ((expected.id && download.id !== expected.id) || download.draftVersion !== expected.version || download.status !== expected.status) return undefined;
  return download;
}
