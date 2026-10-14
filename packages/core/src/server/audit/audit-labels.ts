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
  upload: "Tải lên", delete_queue: "Đưa vào hàng đợi xóa", status_update: "Cập nhật trạng thái",
};
export function auditEntityLabel(code: string) {
  return Object.hasOwn(auditEntityLabels, code) ? auditEntityLabels[code] : code;
}
export function auditActionLabel(code: string) {
  const [subject, verb, extra] = code.split(".");
  if (extra !== undefined || !Object.hasOwn(actionSubjects, subject) || !Object.hasOwn(verbs, verb)) return code;
  return `${verbs[verb]} · ${actionSubjects[subject]}`;
}
export function auditLabelSearchCodes(query: string) {
  if (!query) return { entityTypes: [], actions: [] };
  const keyword = query.normalize("NFC").toLocaleLowerCase("vi-VN");
  const matches = (label: string) => label.normalize("NFC").toLocaleLowerCase("vi-VN").includes(keyword);
  const entityTypes = Object.entries(auditEntityLabels).filter(([, label]) => matches(label)).map(([code]) => code);
  const actions = Object.keys(actionSubjects).flatMap(subject => Object.keys(verbs).map(verb => `${subject}.${verb}`)).filter(code => matches(auditActionLabel(code)));
  return { entityTypes, actions };
}
