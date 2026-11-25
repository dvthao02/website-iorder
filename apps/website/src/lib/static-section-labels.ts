import type { UiMessageKey } from "@iorder/shared/server/translations/ui-messages";

// Tên mục trong thanh mục lục của trang tĩnh khi khối không có tiêu đề, theo ngôn ngữ khách chọn. Chữ gốc của từng khóa giống hệt
// staticPageSectionLabels của CMS (packages/shared/.../static-page-layout.ts); có test giữ hai bên khớp.
export const staticSectionLabelKeys: Record<string, UiMessageKey> = {
  stats: "section.stats",
  media_text: "section.mediaText",
  features: "section.features",
  industries: "section.industries",
  ecosystem: "section.ecosystem",
  process: "section.process",
  partners: "section.partners",
  testimonials: "section.testimonials",
  faq: "section.faq",
  lead_form: "section.leadForm",
  cta: "section.cta",
  rich_text: "section.richText",
  image: "section.image",
  video: "section.video",
  collection_list: "section.collectionList",
  download_list: "section.downloadList",
  featured_posts: "section.featuredPosts",
};

/** Khóa chữ cố định của tên mục dự phòng; loại khối lạ dùng "Nội dung" như CMS. */
export function sectionLabelKey(type: string): UiMessageKey {
  return staticSectionLabelKeys[type] ?? "section.default";
}
