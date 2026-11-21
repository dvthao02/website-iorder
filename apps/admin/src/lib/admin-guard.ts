import { redirect } from "next/navigation";

import { hasAnyCmsPermission, isSuperAdmin, type CmsPermissionCode } from "@iorder/shared/server/auth/permissions";

import { getRequestAdministrator } from "@/lib/backend";

// Chặn ở đầu mỗi trang module: thiếu quyền xem thì chuyển sang màn "Không có quyền"
// thay vì hiện form trống (Backend trả 403 → dữ liệu rỗng). Backend vẫn là nơi quyết định.
// Không dùng forbidden() của Next vì tính năng đó còn ở dạng thử nghiệm (authInterrupts).
// Màn chỉ dành cho Super Admin (Kết nối & khóa API): người khác chuyển sang "Không có quyền". Backend vẫn kiểm lại ở API.
export async function requireSuperAdmin() {
  const administrator = await getRequestAdministrator();
  if (!administrator) redirect("/admin/login");
  if (!isSuperAdmin(administrator)) redirect("/admin/forbidden");
  return administrator;
}

export async function requireAdminPermission(permission: CmsPermissionCode | readonly CmsPermissionCode[]) {
  const administrator = await getRequestAdministrator();
  if (!administrator) redirect("/admin/login");
  if (!hasAnyCmsPermission(administrator, typeof permission === "string" ? [permission] : permission)) redirect("/admin/forbidden");
  return administrator;
}
