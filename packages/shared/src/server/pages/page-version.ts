export class PageVersionConflictError extends Error {
  constructor() {
    super("Trang đã được cập nhật bởi phiên khác. Vui lòng tải lại trước khi lưu; bản nhập hiện tại chưa được ghi.");
    this.name = "PageVersionConflictError";
  }
}
export function assertPageVersion(actual: number, expected: number | undefined) {
  if (expected === undefined || !Number.isSafeInteger(expected) || expected < 0 || actual !== expected) throw new PageVersionConflictError();
}
