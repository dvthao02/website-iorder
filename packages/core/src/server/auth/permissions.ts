export const cmsPermissions = [
  { code: "dashboard.read", name: "Xem tổng quan", description: "Xem bảng điều khiển CMS." },
  { code: "analytics.read", name: "Xem thống kê", description: "Xem thống kê và mức sẵn sàng xuất bản." },
  { code: "content.read", name: "Xem nội dung", description: "Xem nội dung quản trị." },
  { code: "content.write", name: "Biên tập nội dung", description: "Tạo và cập nhật nội dung ở trạng thái nháp." },
  { code: "content.publish", name: "Xuất bản nội dung", description: "Thay đổi trạng thái xuất bản, lịch xuất bản hoặc lưu trữ." },
  { code: "media.manage", name: "Quản lý tệp", description: "Tải lên, cập nhật và xóa tệp phương tiện." },
  { code: "taxonomy.manage", name: "Quản lý phân loại", description: "Quản lý chuyên mục, thẻ và nhóm dữ liệu." },
  { code: "navigation.manage", name: "Quản lý điều hướng", description: "Quản lý menu và liên kết điều hướng." },
  { code: "seo.manage", name: "Quản lý SEO", description: "Quản lý chuyển hướng, cấu hình xuất bản và SEO." },
  { code: "leads.read", name: "Xem khách hàng tiềm năng", description: "Xem thông tin liên hệ do khách gửi." },
  { code: "leads.write", name: "Cập nhật khách hàng tiềm năng", description: "Cập nhật trạng thái xử lý liên hệ." },
  { code: "audit.read", name: "Xem nhật ký", description: "Xem nhật ký hoạt động quản trị." },
  { code: "users.manage", name: "Quản lý người dùng", description: "Tạo, khóa và thay đổi vai trò tài khoản CMS." },
  { code: "roles.manage", name: "Quản lý phân quyền", description: "Xem vai trò và ma trận quyền hệ thống." },
] as const;

export type CmsPermissionCode = (typeof cmsPermissions)[number]["code"];

export const cmsRoles = [
  { code: "admin", name: "Quản trị hệ thống", permissions: cmsPermissions.map((permission) => permission.code) },
  { code: "content_manager", name: "Quản lý nội dung", permissions: ["dashboard.read", "analytics.read", "content.read", "content.write", "content.publish", "media.manage", "taxonomy.manage", "navigation.manage", "seo.manage"] },
  { code: "editor", name: "Biên tập viên", permissions: ["dashboard.read", "content.read", "content.write", "media.manage", "taxonomy.manage"] },
  { code: "publisher", name: "Xuất bản viên", permissions: ["dashboard.read", "content.read", "content.publish", "media.manage"] },
  { code: "marketing", name: "Marketing & SEO", permissions: ["dashboard.read", "analytics.read", "content.read", "content.write", "content.publish", "media.manage", "navigation.manage", "seo.manage"] },
  { code: "support", name: "Chăm sóc khách hàng", permissions: ["dashboard.read", "leads.read", "leads.write", "media.manage"] },
  { code: "analyst", name: "Phân tích", permissions: ["dashboard.read", "analytics.read", "content.read", "leads.read", "audit.read"] },
] as const satisfies ReadonlyArray<{ code: string; name: string; permissions: readonly CmsPermissionCode[] }>;

export type CmsRoleCode = (typeof cmsRoles)[number]["code"];

export function hasCmsPermission(actor: { role?: string; permissions: readonly string[] }, permission: CmsPermissionCode) {
  return actor.role === "admin" || actor.permissions.includes(permission);
}
