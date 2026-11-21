import type { z } from "zod";

const labels: Record<string, string> = {
  title: "Tiêu đề", eyebrow: "Dòng giới thiệu", description: "Mô tả", note: "Dòng phụ",
  slug: "Địa chỉ trang", status: "Trạng thái", seoTitle: "Tiêu đề SEO", seoDescription: "Mô tả SEO",
  canonicalUrl: "Địa chỉ chính thức", mediaId: "Ảnh", label: "Nhãn nút", href: "Đường dẫn",
  primaryAction: "Nút chính", secondaryAction: "Nút phụ", footnote: "Ghi chú",
  seo: "Google và chia sẻ", appearance: "Giao diện", template: "Loại trang",
};
const lists: Record<string, string> = { blocks: "Thành phần", panels: "Mục trượt bổ sung", highlights: "Điểm nổi bật", slides: "Ảnh trượt", items: "Mục", groups: "Nhóm", plans: "Gói" };

/** Chỉ nêu vị trí và ràng buộc, không đưa giá trị người dùng nhập vào thông báo. */
export function pageValidationMessage(issues: z.ZodError["issues"]) {
  const messages = issues.slice(0, 3).map(issue => {
    const path = issue.path;
    const parts: string[] = [];
    for (let index = 0; index < path.length; index++) {
      const key = String(path[index]);
      if (key === "values") continue;
      if (lists[key]) {
        const position = path[index + 1];
        parts.push(typeof position === "number" ? `${lists[key]} ${position + 1}` : lists[key]);
        if (typeof position === "number") index++;
      } else if (labels[key]) parts.push(labels[key]);
    }
    let reason = "Kiểm tra lại nội dung và định dạng.";
    if (issue.code === "too_big") reason = `Vượt giới hạn ${issue.maximum} ${issue.origin === "array" ? "mục" : issue.origin === "string" ? "ký tự" : ""}.`;
    if (issue.code === "too_small") reason = issue.minimum === 1 ? "Không được để trống." : `Cần tối thiểu ${issue.minimum} ${issue.origin === "array" ? "mục" : "ký tự"}.`;
    if (issue.code === "unrecognized_keys") reason = "Cấu trúc dữ liệu chưa được máy chủ hỗ trợ. Kiểm tra phiên bản CMS và Backend.";
    return `${parts.join(" → ") || "Thông tin trang"}: ${reason}`;
  });
  return messages.join(" ");
}
