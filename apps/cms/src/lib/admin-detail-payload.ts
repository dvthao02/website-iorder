import { z } from "zod";

export function validateContentStateResponse(payload: unknown, requestUrl: string, body: unknown, action: "archive" | "restore"): void {
  const fail = () => { throw new Error("Chưa xác nhận được kết quả cập nhật. Hãy tải lại danh sách để kiểm tra trước khi thử lại."); };
  const request = z.object({ id: z.string().uuid().optional(), expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1) }).safeParse(body);
  if (!request.success) return fail();
  const pathname = new URL(requestUrl, "http://cms.local").pathname;
  const status = action === "archive" ? "archived" : "draft";
  const version = request.data.expectedVersion + 1;
  if (pathname === "/api/admin/equipment") {
    const saved = z.object({ id: z.string().uuid(), version: z.literal(version) }).safeParse(payload);
    if (!request.data.id || !saved.success || saved.data.id !== request.data.id) return fail();
    // Equipment POST returns only ID/version; its response does not expose status.
    return;
  }
  if (pathname.startsWith("/api/admin/equipment/")) {
    const saved = z.object({ id: z.string().uuid(), status: z.literal(status), version: z.literal(version) }).safeParse(payload && typeof payload === "object" ? Reflect.get(payload, "equipment") : undefined);
    const expectedId = pathname.split("/").at(-1);
    if (!expectedId || !saved.success || saved.data.id !== expectedId) return fail();
    return;
  }
  const key = pathname === "/api/admin/pages" ? "page" : pathname.startsWith("/api/admin/posts/") ? "post" : pathname.startsWith("/api/admin/offerings/") ? "offering" : undefined;
  const expectedId = key === "page" ? request.data.id : pathname.split("/").at(-1);
  const entity = payload && typeof payload === "object" && key ? Reflect.get(payload, key) : undefined;
  const saved = z.object({ id: z.string().uuid(), draftVersion: z.literal(version), status: z.literal(status) }).safeParse(entity);
  if (!expectedId || !saved.success || saved.data.id !== expectedId) return fail();
}

export function parseDeletedEntityId(payload: unknown, requestUrl: string): string {
  const parsed = z.object({ deletedId: z.string().uuid() }).safeParse(payload);
  const pathname = new URL(requestUrl, "http://cms.local").pathname;
  const expectedId = pathname.split("/").at(-1);
  if (!parsed.success || !z.string().uuid().safeParse(expectedId).success || parsed.data.deletedId !== expectedId) {
    throw new Error("Chưa xác nhận được kết quả xóa. Hãy tải lại danh sách để kiểm tra trước khi thử lại.");
  }
  return parsed.data.deletedId;
}

export function parseSavedEntityVersion(payload: unknown, expectedVersion: number): number {
  const parsed = z.object({ version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).safeParse(payload);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || !parsed.success || parsed.data.version !== expectedVersion) {
    throw new Error("Phiên bản phản hồi lưu không khớp. Hãy kiểm tra danh sách trước khi thử lại.");
  }
  return parsed.data.version;
}

export function parseSavedEntityId(payload: unknown, expectedId?: string): string {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(payload);
  if (!parsed.success || (expectedId !== undefined && parsed.data.id !== expectedId)) {
    throw new Error("Phản hồi lưu không hợp lệ hoặc không khớp. Hãy kiểm tra danh sách trước khi thử lại.");
  }
  return parsed.data.id;
}

export function parseAdminDetailPayload<T extends { id: string }>(payload: unknown, key: string, schema: z.ZodType<T>, expectedId: string): T {
  const value = payload && typeof payload === "object" ? Reflect.get(payload, key) : undefined;
  const parsed = schema.safeParse(value);
  if (!parsed.success || parsed.data.id !== expectedId) throw new Error("Phản hồi nội dung không hợp lệ hoặc không khớp. Vui lòng tải lại.");
  return parsed.data;
}
