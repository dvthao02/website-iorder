import { z } from "zod";

export const expectedVersionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const contentUpdateRequestSchema = z.object({ expectedVersion: expectedVersionSchema }).passthrough();
// Ghi dữ liệu cấu hình/danh mục có version: { values, expectedVersion }; sai version → 409.
export const versionedWriteRequestSchema = z.object({ values: z.unknown(), expectedVersion: expectedVersionSchema }).strict();
export const contentDeleteRequestSchema = contentUpdateRequestSchema.strict();
export const contentStateRequestSchema = z.object({ action: z.enum(["archive", "restore"]), expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();

export class ContentVersionConflictError extends Error {
  constructor() {
    super("Nội dung đã thay đổi hoặc bị xóa trong phiên khác. Vui lòng tải lại trước khi lưu; bản nhập hiện tại chưa được ghi.");
    this.name = "ContentVersionConflictError";
  }
}
export function assertContentVersion(actual: number, expected: number) {
  if (!Number.isSafeInteger(expected) || expected < 0 || actual !== expected) throw new ContentVersionConflictError();
}

export function contentStateAfterAction(current: { status: "draft" | "review" | "scheduled" | "published" | "archived"; draftVersion: number }, action: "archive" | "restore", expectedVersion: number): "draft" | "archived" {
  contentStateRequestSchema.parse({ action, expectedVersion });
  assertContentVersion(current.draftVersion, expectedVersion);
  if ((action === "restore") !== (current.status === "archived")) throw new ContentVersionConflictError();
  return action === "archive" ? "archived" : "draft";
}
