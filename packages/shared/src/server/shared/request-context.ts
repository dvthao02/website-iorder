import { AsyncLocalStorage } from "node:async_hooks";

// Ngữ cảnh của request đang xử lý (Backend bọc route handler bằng runWithRequestContext).
// Bảng audit_logs đọc giá trị này làm mặc định khi insert, nên mọi chỗ ghi nhật ký tự có IP,
// thiết bị và mã request mà không phải truyền tham số qua từng service/repository.
// Chỉ dùng run(): enterWith() hoạt động khác nhau giữa Node 22 và 24 và có thể rò sang request khác.
export type RequestContext = { ipAddress: string | null; userAgent: string | null; requestId: string | null };

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
