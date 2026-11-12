import type { PageBlock } from "./pages.contract";
import { blockAnchor } from "./block-layout";

export type StaticPageProfile = "about" | "contact" | "document" | "support" | "general";
const profiles: Record<string, StaticPageProfile> = {
  about: "about", contact: "contact", terms: "document", "privacy-policy": "document",
  "support-faq": "support", "support-videos": "support", "remote-support": "support",
};
export function staticPageProfile(slug: string, template?: string): StaticPageProfile {
  return profiles[slug] ?? (template === "contact" ? "contact" : "general");
}
export const staticPageHints: Record<StaticPageProfile, string> = {
  about: "Giới thiệu: ảnh và chữ, số liệu, đối tác và lời mời liên hệ. Nền, độ rộng, khoảng cách chỉnh ở “Bố cục khối”.",
  contact: "Liên hệ: tiêu đề gọn, thông tin doanh nghiệp và biểu mẫu, câu hỏi thường gặp. Thông tin liên hệ lấy từ Thông tin doanh nghiệp.",
  document: "Chính sách và điều khoản: phần đầu gọn, nội dung trong cột dễ đọc. Dùng tiêu đề H2/H3 để có mục lục.",
  support: "Hỗ trợ: phần đầu rõ mục đích, nội dung theo nhóm/câu hỏi hoặc các bước. Giữ liên kết và thứ tự của từng mục.",
  general: "Chọn từng phần để sửa. “Bố cục khối” chỉnh nền, độ rộng, khoảng cách của cả khối; từng mục con có “Bố cục mục” để căn chữ.",
};
const labels: Record<string, string> = {
  stats: "Số liệu nổi bật", media_text: "Giới thiệu", features: "Nội dung nổi bật", industries: "Lĩnh vực",
  ecosystem: "Hệ sinh thái", process: "Các bước thực hiện", partners: "Đối tác và khách hàng",
  testimonials: "Đánh giá", faq: "Câu hỏi thường gặp", lead_form: "Liên hệ tư vấn", cta: "Liên hệ",
  rich_text: "Nội dung chính", image: "Hình ảnh", video: "Video", collection_list: "Danh sách nội dung", download_list: "Tài liệu tải về", featured_posts: "Bài viết",
};

/** Chỉ tạo neo hiển thị; không thay JSONB hay ghi đè mã neo do người dùng đã chọn. */
export function staticPageSections(blocks: readonly PageBlock[]) {
  const enabled = blocks.filter(block => block.isEnabled);
  const used = new Set(["noi-dung", ...enabled.map(blockAnchor).filter((id): id is string => Boolean(id))]);
  const sectionIds: Array<string | undefined> = enabled.map(() => undefined);
  const sections = enabled.flatMap((block, index) => {
    if (block.type === "hero") return [];
    const existing = blockAnchor(block);
    let id = existing ?? `phan-noi-dung-${index + 1}`;
    if (!existing) {
      const base = id;
      let suffix = 2;
      while (used.has(id)) id = `${base}-${suffix++}`;
      used.add(id);
      sectionIds[index] = id;
    }
    const data = block.data as Record<string, unknown>;
    const heading = [data.title, data.heading].find(value => typeof value === "string" && value.trim());
    return [{ id, label: typeof heading === "string" ? heading.trim() : labels[block.type] ?? "Nội dung", index }];
  });
  return { sections, sectionIds };
}
