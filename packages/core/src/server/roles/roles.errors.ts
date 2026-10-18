// One error type for role/user access rules; routes map `status` to the HTTP response.
export class CmsAccessError extends Error {
  constructor(readonly code: "FORBIDDEN" | "ROLE_PROTECTED" | "ROLE_IN_USE" | "NOT_FOUND", message: string, readonly status: 403 | 404 | 409) {
    super(message);
    this.name = "CmsAccessError";
  }
}

export const accessErrors = {
  notAllowed: () => new CmsAccessError("FORBIDDEN", "Bạn không còn quyền thực hiện thao tác này. Vui lòng đăng nhập lại.", 403),
  escalation: () => new CmsAccessError("FORBIDDEN", "Không thể cấp quyền mà bạn không có.", 403),
  ownRole: () => new CmsAccessError("FORBIDDEN", "Không thể tự sửa vai trò của chính mình.", 403),
  self: () => new CmsAccessError("FORBIDDEN", "Không thể tự đổi vai trò hoặc khóa chính tài khoản đang đăng nhập.", 403),
  superAdminOnly: () => new CmsAccessError("FORBIDDEN", "Chỉ Super Admin được thay đổi tài khoản hoặc vai trò Super Admin.", 403),
  protectedRole: () => new CmsAccessError("ROLE_PROTECTED", "Vai trò Super Admin được bảo vệ, không thể sửa hoặc xóa.", 403),
  roleInUse: (count: number) => new CmsAccessError("ROLE_IN_USE", `Vai trò đang được gán cho ${count} tài khoản. Hãy chuyển các tài khoản sang vai trò khác trước khi xóa.`, 409),
  roleNotFound: () => new CmsAccessError("NOT_FOUND", "Không tìm thấy vai trò.", 404),
};
