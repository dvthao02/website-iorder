export const auditEntityLabels: Record<string, string> = {
  page: "Trang website", post: "Bài viết", offering: "Sản phẩm/Giải pháp/Dịch vụ",
  equipment: "Thiết bị", equipment_group: "Nhóm thiết bị", media: "Hình ảnh và tệp",
  partner: "Đối tác", testimonial: "Đánh giá", support_download: "Tệp hỗ trợ",
  contact_lead: "Liên hệ khách hàng", user: "Tài khoản", menu: "Menu điều hướng",
  category: "Chuyên mục", tag: "Thẻ", redirect: "Chuyển hướng",
  site_setting: "Cấu hình website", site_profile: "Thông tin doanh nghiệp",
};
const actionSubjects: Record<string, string> = {
  ...auditEntityLabels, lead: "Liên hệ khách hàng", navigation: "Menu điều hướng",
  profile: "Thông tin doanh nghiệp", publishing_config: "SEO và xuất bản",
  external_links: "Liên kết ngoài", catalog_content: "Nội dung danh mục", listing_content: "Nội dung trang danh sách",
};
const verbs: Record<string, string> = {
  create: "Tạo", update: "Cập nhật", delete: "Xóa", archive: "Lưu trữ", restore: "Khôi phục",
  upload: "Tải lên", delete_queue: "Đưa vào hàng đợi xóa", status_update: "Cập nhật trạng thái", password_change: "Đổi mật khẩu", export: "Xuất dữ liệu",
};
// Thao tác tự nói đủ nghĩa, không cần ghép "· Tài khoản".
const actionOverrides: Record<string, string> = {
  "user.login": "Đăng nhập", "user.login_failed": "Đăng nhập thất bại (sai mật khẩu)", "user.logout": "Đăng xuất",
};
export function auditEntityLabel(code: string) {
  return Object.hasOwn(auditEntityLabels, code) ? auditEntityLabels[code] : code;
}
export function auditActionLabel(code: string) {
  if (Object.hasOwn(actionOverrides, code)) return actionOverrides[code];
  const [subject, verb, extra] = code.split(".");
  if (extra !== undefined || !Object.hasOwn(actionSubjects, subject) || !Object.hasOwn(verbs, verb)) return code;
  return `${verbs[verb]} · ${actionSubjects[subject]}`;
}
export function auditLabelSearchCodes(query: string) {
  if (!query) return { entityTypes: [], actions: [] };
  const keyword = query.normalize("NFC").toLocaleLowerCase("vi-VN");
  const matches = (label: string) => label.normalize("NFC").toLocaleLowerCase("vi-VN").includes(keyword);
  const entityTypes = Object.entries(auditEntityLabels).filter(([, label]) => matches(label)).map(([code]) => code);
  const actions = [...Object.keys(actionOverrides), ...Object.keys(actionSubjects).flatMap(subject => Object.keys(verbs).map(verb => `${subject}.${verb}`))].filter(code => matches(auditActionLabel(code)));
  return { entityTypes, actions };
}

const fieldLabels: Record<string, string> = {
  title: "Tiêu đề", name: "Tên", slug: "Đường dẫn", status: "Trạng thái", summary: "Tóm tắt", excerpt: "Mô tả ngắn",
  content: "Nội dung", body: "Nội dung", blocks: "Khối nội dung", seoTitle: "Tiêu đề SEO", seoDescription: "Mô tả SEO",
  canonicalUrl: "URL chuẩn", coverMediaId: "Ảnh bìa", mediaId: "Tệp", publishedAt: "Ngày xuất bản", scheduledAt: "Hẹn giờ",
  isEnabled: "Hiển thị", sortOrder: "Thứ tự", fullName: "Họ tên", username: "Tên đăng nhập", email: "Email",
  roleIds: "Vai trò", roles: "Vai trò", permissions: "Quyền", altText: "Mô tả ảnh", priceVnd: "Giá",
  modelCode: "Mã model", groupId: "Nhóm", categoryIds: "Chuyên mục", tagIds: "Thẻ", sourcePath: "Đường dẫn cũ",
  destinationPath: "Đường dẫn mới", statusCode: "Mã chuyển hướng", items: "Danh sách mục", rows: "Số dòng",
  query: "Từ khóa", type: "Loại", description: "Mô tả", phone: "Điện thoại", address: "Địa chỉ", url: "Liên kết",
  passwordChanged: "Mật khẩu", role: "Vai trò", parentId: "Chuyên mục cha", facebook: "Facebook", youtube: "YouTube", zalo: "Zalo", tiktok: "TikTok",
};
// Trường kỹ thuật thay đổi ở mọi lần lưu, không giúp người đọc nhật ký.
const technicalFields = new Set(["version", "updatedAt", "updatedBy", "createdAt", "id", "draftVersion"]);
export function auditFieldLabels(fields: readonly string[]) {
  return fields.filter(field => !technicalFields.has(field)).map(field => Object.hasOwn(fieldLabels, field) ? fieldLabels[field] : field);
}
