import { redirect } from "next/navigation";

import { hasAnyCmsPermission, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";

import { getRequestAdministrator } from "@/lib/backend";

// Chặn ở đầu mỗi trang module: thiếu quyền xem thì chuyển sang màn "Không có quyền"
// thay vì hiện form trống (Backend trả 403 → dữ liệu rỗng). Backend vẫn là nơi quyết định.
// Không dùng forbidden() của Next vì tính năng đó còn ở dạng thử nghiệm (authInterrupts).
export async function requireAdminPermission(permission: CmsPermissionCode | readonly CmsPermissionCode[]) {
  const administrator = await getRequestAdministrator();
  if (!administrator) redirect("/admin/login");
  if (!hasAnyCmsPermission(administrator, typeof permission === "string" ? [permission] : permission)) redirect("/admin/khong-co-quyen");
  return administrator;
}
