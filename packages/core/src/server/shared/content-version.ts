import { z } from "zod";

export const contentUpdateRequestSchema = z.object({ expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).passthrough();
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
