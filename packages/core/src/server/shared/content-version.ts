import { z } from "zod";

export const expectedVersionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const contentUpdateRequestSchema = z.object({ expectedVersion: expectedVersionSchema }).passthrough();
// Ghi dữ liệu cấu hình/danh mục có version: { values, expectedVersion }; sai version → 409.
export const versionedWriteRequestSchema = z.object({ values: z.unknown(), expectedVersion: expectedVersionSchema }).strict();
export const contentDeleteRequestSchema = contentUpdateRequestSchema.strict();
// publish: xuất bản ngay bản đang lưu (dùng cho xuất bản hàng loạt); mục đã lưu trữ phải khôi phục trước.
export const contentStateRequestSchema = z.object({ action: z.enum(["archive", "restore", "publish"]), expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();

export class ContentVersionConflictError extends Error {
  constructor() {
    super("Nội dung đã thay đổi hoặc bị xóa trong phiên khác. Vui lòng tải lại trước khi lưu; bản nhập hiện tại chưa được ghi.");
    this.name = "ContentVersionConflictError";
  }
}
// Chuyển trạng thái không hợp lệ (ví dụ xuất bản mục đang lưu trữ): cùng mã 409 nhưng thông báo rõ lý do.
export class ContentStateTransitionError extends ContentVersionConflictError {
  constructor(message: string) {
    super();
    this.message = message;
    this.name = "ContentStateTransitionError";
  }
}
export function assertContentVersion(actual: number, expected: number) {
  if (!Number.isSafeInteger(expected) || expected < 0 || actual !== expected) throw new ContentVersionConflictError();
}

export type ContentStateAction = z.infer<typeof contentStateRequestSchema>["action"];
export const contentStateChangeNotes: Record<ContentStateAction, string> = { archive: "Lưu trữ", restore: "Khôi phục về bản nháp", publish: "Xuất bản" };

export function contentStateAfterAction(current: { status: "draft" | "review" | "scheduled" | "published" | "archived"; draftVersion: number }, action: ContentStateAction, expectedVersion: number): "draft" | "archived" | "published" {
  contentStateRequestSchema.parse({ action, expectedVersion });
  assertContentVersion(current.draftVersion, expectedVersion);
  if (action === "publish") {
    if (current.status === "archived") throw new ContentStateTransitionError("Nội dung đang lưu trữ; hãy khôi phục trước khi xuất bản.");
    if (current.status === "published") throw new ContentStateTransitionError("Nội dung đã được xuất bản.");
    return "published";
  }
  if ((action === "restore") !== (current.status === "archived")) throw new ContentVersionConflictError();
  return action === "archive" ? "archived" : "draft";
}
