export class CmsUserPermissionError extends Error {
  constructor() {
    super("Bạn không còn quyền quản lý tài khoản. Vui lòng đăng nhập lại.");
    this.name = "CmsUserPermissionError";
  }
}
