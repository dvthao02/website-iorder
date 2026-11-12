"use client";
import { BuilderItemsTree } from "./builder-items-tree";
import { builderItemCollections, builderItemLabel, replaceBuilderItems, selectionFromItemId, type BuilderItemSelection } from "./ui/builder-item-model";
import { RichTextEditor } from "./rich-text/rich-text-editor";
import { plainTextToRichDocument, richPlainText } from "@iorder/shared/server/shared/rich-text";

import { AlignCenter, AlignLeft, AlignRight, ChevronRight, CopyPlus, Eye, EyeOff, GripVertical, PanelLeft, PanelTop, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { collectionSources, heroToneOf, type CollectionSource, type ColumnItem, type ItemAlign, type HeroTone, type PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { blockAnchor, isDarkColor } from "@iorder/shared/server/pages/block-layout";
import { youtubeEmbedUrl, youtubeVideoId } from "@iorder/shared/server/shared/youtube";
import { settingLinkHref, settingLinkKey, settingLinkOptions, type SettingLinkKey } from "@iorder/shared/server/pages/setting-links";

import { BlockAppearanceFields, ColorPicker, colorSwatches, defaultAppearance } from "./block-appearance-fields";
import { MediaPicker } from "./media-picker";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminStatusBadge } from "./ui/admin-feedback";
import { reorder, useDragReorder } from "./ui/use-drag-reorder";
import { LayoutPicker, cardStylePreviews, heroLayoutPreviews, type LayoutOption } from "./ui/layout-picker";
import { BlockLibrary } from "./ui/block-library";
import { AdminListEditor, AdminListRowControls, moveListItem } from "./ui/admin-list-editor";
import { IconPicker } from "./ui/icon-picker";

type BlockType = PageBlock["type"];
type CardBlock = Extract<PageBlock, { type: "features" | "industries" | "ecosystem" | "process" }>;
type Action = { label: string; href: string };

type PageBlockPreset = {
  description: string;
  id: string;
  label: string;
  types: BlockType[];
};

// Mẫu chỉ ghép các thành phần đã có schema/render sẵn: thêm nhanh mà không tạo dữ liệu đặc biệt hay migration.
const pageBlockPresets: ReadonlyArray<PageBlockPreset> = [
  { id: "introduction", label: "Trang giới thiệu", description: "Phần đầu, ảnh + chữ, lợi ích và lời kêu gọi liên hệ.", types: ["hero", "media_text", "features", "cta"] },
  { id: "sales", label: "Trang bán hàng", description: "Phần đầu, lợi ích, bảng giá, câu hỏi và form tư vấn.", types: ["hero", "features", "pricing", "faq", "lead_form"] },
  { id: "catalog", label: "Trang danh mục", description: "Phần đầu, nội dung theo nhóm, danh sách tự cập nhật và CTA.", types: ["hero", "grouped_list", "collection_list", "cta"] },
  { id: "trust", label: "Trang tạo niềm tin", description: "Phần đầu, số liệu, logo đối tác, đánh giá và CTA.", types: ["hero", "stats", "partners", "testimonials", "cta"] },
  { id: "long-form", label: "Trang nội dung chuyên sâu", description: "Phần đầu, ảnh + chữ, bài viết, video, câu hỏi và CTA.", types: ["hero", "media_text", "rich_text", "video", "faq", "cta"] },
  { id: "resources", label: "Trang tài liệu", description: "Phần đầu, giới thiệu, danh sách nội dung, form nhận tư vấn và CTA.", types: ["hero", "rich_text", "collection_list", "lead_form", "cta"] },
];

// `legacy`: loại cũ vẫn sửa được trên trang đã lưu, nhưng không cho thêm mới (dùng "Danh sách nội dung").
const blockGroups = ["Mở đầu", "Giới thiệu", "Bố cục", "Sản phẩm & nội dung", "Tạo niềm tin", "Chuyển đổi", "Văn bản & hình ảnh"] as const;
type BlockGroup = (typeof blockGroups)[number];
type LibraryBlockOption = { id: string; type: BlockType; label: string; description: string; group: BlockGroup };

// Mỗi nhóm giữ 3–5 lựa chọn. Một vài lựa chọn là biến thể khởi tạo của cùng loại khối,
// để người soạn chọn đúng kiểu hiển thị ngay từ đầu thay vì thêm rồi tự dò trong phần thiết lập.
const libraryBlockOptions: ReadonlyArray<LibraryBlockOption> = [
  { id: "hero-split", type: "hero", label: "Tiêu đề + ảnh", description: "Chữ trái, ảnh phải; hợp giới thiệu sản phẩm hoặc dịch vụ.", group: "Mở đầu" },
  { id: "hero-background", type: "hero", label: "Ảnh nền tràn màn hình", description: "Ảnh phủ khung với chữ bên trên; hợp ảnh không gian hoặc công trình.", group: "Mở đầu" },
  { id: "hero-centered", type: "hero", label: "Tiêu đề căn giữa", description: "Trang ngắn hoặc thông điệp thương hiệu, ảnh nằm phía dưới.", group: "Mở đầu" },

  { id: "media-right", type: "media_text", label: "Chữ trái · ảnh phải", description: "Ảnh minh họa nằm bên phải; tiêu đề, mô tả và nút nằm bên trái.", group: "Giới thiệu" },
  { id: "media-left", type: "media_text", label: "Ảnh trái · chữ phải", description: "Ảnh minh họa nằm bên trái; tiêu đề, mô tả và nút nằm bên phải.", group: "Giới thiệu" },
  { id: "features-compact", type: "features", label: "Lưới lợi ích", description: "Thẻ gọn có biểu tượng, tiêu đề và mô tả ngắn.", group: "Giới thiệu" },
  { id: "features-visual", type: "features", label: "Lưới thẻ ảnh", description: "Thẻ ảnh phù hợp giới thiệu các mảng sản phẩm hoặc dịch vụ.", group: "Giới thiệu" },
  { id: "columns-two", type: "columns", label: "2 cột", description: "Hai cột đều nhau; mỗi cột tự xếp tiêu đề, đoạn văn, ảnh, nút hoặc danh sách.", group: "Bố cục" },
  { id: "columns-two-wide", type: "columns", label: "2 cột 60/40", description: "Cột trái rộng hơn: chữ nhiều bên trái, ảnh hoặc nút bên phải.", group: "Bố cục" },
  { id: "columns-three", type: "columns", label: "3 cột", description: "Ba cột đều nhau cho ba ý ngắn song song.", group: "Bố cục" },
  { id: "columns-four", type: "columns", label: "4 cột", description: "Bốn cột đều nhau; trên máy tính bảng tự xếp hai hàng.", group: "Bố cục" },
  { id: "process", type: "process", label: "Quy trình", description: "Các bước triển khai hoặc cách bắt đầu theo thứ tự.", group: "Giới thiệu" },

  { id: "grouped-list", type: "grouped_list", label: "Danh sách theo nhóm", description: "Nhóm ngành, nhóm thiết bị hoặc các nhu cầu thường gặp.", group: "Sản phẩm & nội dung" },
  { id: "collection-software", type: "collection_list", label: "Danh sách phần mềm", description: "Tự lấy các phần mềm đã xuất bản từ mục Sản phẩm & Dịch vụ.", group: "Sản phẩm & nội dung" },
  { id: "collection-solution", type: "collection_list", label: "Danh sách giải pháp", description: "Tự lấy các giải pháp đã xuất bản từ mục Sản phẩm & Dịch vụ.", group: "Sản phẩm & nội dung" },
  { id: "pricing", type: "pricing", label: "Bảng giá", description: "So sánh 1–4 gói với tính năng, giá và nút đăng ký.", group: "Sản phẩm & nội dung" },

  { id: "stats", type: "stats", label: "Số liệu nổi bật", description: "Các con số tạo điểm nhấn: cửa hàng, đơn hàng, năm kinh nghiệm…", group: "Tạo niềm tin" },
  { id: "partners", type: "partners", label: "Logo đối tác", description: "Hiển thị logo đối tác đã quản lý trong CMS.", group: "Tạo niềm tin" },
  { id: "customers", type: "partners", label: "Logo khách hàng", description: "Hiển thị riêng logo khách hàng đã quản lý trong CMS.", group: "Tạo niềm tin" },
  { id: "testimonials", type: "testimonials", label: "Cảm nhận khách hàng", description: "Hiển thị đánh giá đã quản lý trong CMS.", group: "Tạo niềm tin" },

  { id: "cta-contact", type: "cta", label: "Kêu gọi liên hệ", description: "Một thông điệp ngắn với nút dẫn tới trang Liên hệ.", group: "Chuyển đổi" },
  { id: "cta-trial", type: "cta", label: "Kêu gọi dùng thử", description: "Nút dùng địa chỉ Đăng ký dùng thử trong Cài đặt.", group: "Chuyển đổi" },
  { id: "lead-form", type: "lead_form", label: "Biểu mẫu nhận tư vấn", description: "Khách để lại thông tin, CMS chuyển vào Khách hàng tiềm năng.", group: "Chuyển đổi" },
  { id: "faq", type: "faq", label: "Câu hỏi thường gặp", description: "Giải đáp các băn khoăn trước khi khách liên hệ.", group: "Chuyển đổi" },

  { id: "rich-text", type: "rich_text", label: "Đoạn văn bản", description: "Nội dung chữ tự do với tiêu đề tùy chọn.", group: "Văn bản & hình ảnh" },
  { id: "image", type: "image", label: "Hình ảnh", description: "Một ảnh từ thư viện media, có mô tả và chú thích.", group: "Văn bản & hình ảnh" },
  { id: "video", type: "video", label: "Video YouTube", description: "Video 16:9, tiêu đề và chú thích tùy chọn.", group: "Văn bản & hình ảnh" },
  { id: "media-story", type: "media_text", label: "Câu chuyện bằng ảnh", description: "Ảnh trái + chữ phải, phù hợp câu chuyện thương hiệu hoặc dự án.", group: "Văn bản & hình ảnh" },
];
const blockOptions: ReadonlyArray<{ value: BlockType; label: string; description: string; group: (typeof blockGroups)[number] | ""; legacy?: boolean }> = [
  { value: "hero", label: "Phần đầu trang", description: "Tiêu đề lớn và nút; 5 kiểu: chữ – ảnh, ảnh nền tràn màn hình, trượt nhiều ảnh…", group: "Mở đầu" },
  { value: "media_text", label: "Ảnh + chữ", description: "Ảnh một bên, tiêu đề, mô tả, danh sách ✓ và nút bên kia. Xếp nhiều khối xen kẽ trái/phải.", group: "Giới thiệu" },
  { value: "features", label: "Lưới thẻ", description: "Thẻ gọn, thẻ ảnh hoặc 1 thẻ lớn + 4 thẻ nhỏ: tính năng, lợi ích, các mảng sản phẩm… Đặt nền tối thì thành hai cột.", group: "Giới thiệu" },
  { value: "industries", label: "Lĩnh vực áp dụng (cũ)", description: "", group: "", legacy: true },
  { value: "ecosystem", label: "Hệ sinh thái (cũ)", description: "", group: "", legacy: true },
  { value: "columns", label: "Nhiều cột", description: "Tự dựng bố cục 2–4 cột: mỗi cột xếp tiêu đề, đoạn văn, ảnh, nút hoặc danh sách ✓.", group: "Bố cục" },
  { value: "process", label: "Quy trình", description: "Các bước thực hiện theo thứ tự.", group: "Giới thiệu" },
  { value: "grouped_list", label: "Danh sách theo nhóm", description: "Thẻ theo nhóm (nhóm ngành, nhóm thiết bị…), mỗi thẻ là danh sách mục ngắn có biểu tượng, liên kết và một nút.", group: "Giới thiệu" },
  { value: "stats", label: "Số liệu nổi bật", description: "Các con số kèm nhãn ngắn.", group: "Giới thiệu" },
  { value: "collection_list", label: "Danh sách nội dung", description: "Bài viết, sản phẩm, thiết bị… tự cập nhật khi có nội dung mới; giới hạn số mục thì có nút “Xem tất cả”.", group: "Sản phẩm & nội dung" },
  { value: "pricing", label: "Bảng giá", description: "1–4 gói: giá, danh sách tính năng, nút; gói nổi bật được làm to.", group: "Sản phẩm & nội dung" },
  { value: "testimonials", label: "Cảm nhận khách hàng", description: "Lấy từ mục Đối tác & Đánh giá.", group: "Tạo niềm tin" },
  { value: "partners", label: "Logo đối tác, khách hàng", description: "Lấy từ mục Đối tác & Đánh giá; từ 8 logo tự chạy thành dải ngang.", group: "Tạo niềm tin" },
  { value: "cta", label: "Kêu gọi hành động", description: "Một dòng tiêu đề và một nút.", group: "Chuyển đổi" },
  { value: "lead_form", label: "Biểu mẫu nhận tư vấn", description: "Form ngắn gửi về Khách hàng tiềm năng, kèm hotline/email từ Cài đặt và lối tắt Đăng ký dùng thử.", group: "Chuyển đổi" },
  { value: "faq", label: "Câu hỏi thường gặp", description: "Danh sách câu hỏi và trả lời.", group: "Chuyển đổi" },
  { value: "rich_text", label: "Đoạn văn bản", description: "Tiêu đề và nội dung chữ tự do.", group: "Văn bản & hình ảnh" },
  { value: "image", label: "Hình ảnh", description: "Một ảnh từ thư viện media, kèm chú thích.", group: "Văn bản & hình ảnh" },
  { value: "video", label: "Video YouTube", description: "Dán link YouTube, video nhúng khung 16:9 kèm tiêu đề và chú thích. Trong bài viết dùng nút ▶ trên thanh soạn thảo.", group: "Văn bản & hình ảnh" },
  { value: "featured_posts", label: "Bài viết nổi bật (cũ)", description: "", group: "", legacy: true },
  { value: "download_list", label: "Danh sách tải về (cũ)", description: "", group: "", legacy: true },
];

// Trang danh sách (tin tức, thiết bị…) chỉ cần khối phục vụ việc đọc danh sách; khối giới thiệu kiểu trang chủ để ở trang thường.
const listingBlockTypes: ReadonlySet<BlockType> = new Set(["collection_list", "rich_text", "image", "video", "stats", "faq", "cta", "lead_form", "testimonials", "partners"]);

export function blockLabel(type: BlockType) {
  return blockOptions.find((option) => option.value === type)?.label ?? type;
}

// Dòng tóm tắt khi khối đang gập, để nhìn được cả trang mà không mở từng khối.
export function blockSummary(block: PageBlock) {
  switch (block.type) {
    case "hero": return `${heroLayoutOptions.find((option) => option.value === block.data.layout)?.label ?? ""} · ${block.data.title}`;
    case "stats": return block.data.title ?? `${block.data.items.length} số liệu`;
    case "rich_text": return block.data.heading ?? (typeof block.data.body === "string" ? block.data.body : richPlainText(block.data.body)).slice(0, 80);
    case "image": return block.data.alt ?? block.data.caption ?? (block.data.mediaId ? "Đã chọn ảnh" : "Chưa chọn ảnh");
    case "video": return block.data.title ?? block.data.caption ?? (youtubeVideoId(block.data.url) ? block.data.url : "Chưa có link video");
    case "collection_list": return [collectionSources.find((source) => source.value === block.data.source)?.label, block.data.title].filter(Boolean).join(" · ");
    case "lead_form": return block.data.title;
    case "columns": return [`${block.data.columns.length} cột`, block.data.title].filter(Boolean).join(" · ");
    case "cta": return block.data.title;
    case "features":
    case "industries":
    case "ecosystem": return [cardStyleOptions.find(option => option.value === (block.data.cardStyle ?? "compact"))?.label, block.data.title].filter(Boolean).join(" · ");
    default: return "title" in block.data ? block.data.title ?? "" : "";
  }
}

// Nhãn nhỏ trên dòng khối đang gập: những gì đã chỉnh ở Giao diện khối (để "Tự động" thì không hiện gì).
const toneTags: Partial<Record<string, string>> = { white: "Nền trắng", tinted: "Nền xám nhạt", dark: "Nền tối" };
function appearanceTags(block: PageBlock) {
  const appearance = block.appearance;
  const tags: { label: string; color?: string }[] = [];
  if (appearance?.tone === "custom" && appearance.backgroundColor) tags.push({ label: "Màu riêng", color: appearance.backgroundColor });
  else if (appearance?.tone && toneTags[appearance.tone] && block.type !== "hero") tags.push({ label: toneTags[appearance.tone]! });
  if (appearance?.backgroundMediaId) tags.push({ label: "Ảnh nền" });
  if (appearance?.width) tags.push({ label: `Rộng ${appearance.width}%` });
  const anchor = blockAnchor(block);
  if (anchor) tags.push({ label: `#${anchor}` });
  return tags;
}

// Bản sao của một khối để nhân bản: bỏ mã neo (neo phải là duy nhất trên trang).
function duplicateBlock(block: PageBlock): PageBlock {
  const copy = structuredClone(block);
  if (copy.appearance) copy.appearance = { ...copy.appearance, anchor: null };
  if (copy.type === "cta") copy.data = { ...copy.data, id: null };
  if (copy.type === "collection_list") copy.data = { ...copy.data, anchor: null };
  return copy;
}

function newBlock(type: BlockType): PageBlock {
  switch (type) {
    case "hero": return { type, isEnabled: true, data: { eyebrow: null, title: "Tiêu đề mới", description: null, primaryAction: null, secondaryAction: null, mediaId: null, layout: "split", highlights: [], footnote: null, slides: [], extraMediaIds: [], tone: null, panels: [] } };
    case "stats": return { type, isEnabled: true, data: { eyebrow: null, title: null, items: [{ value: "0", label: "Nhãn số liệu", note: null }] } };
    case "features":
    case "industries":
    case "ecosystem":
    case "process": return { type, isEnabled: true, data: { eyebrow: null, title: "Tiêu đề mới", description: null, items: [{ title: "Mục mới", description: "Mô tả", href: null }] } };
    case "testimonials": return { type, isEnabled: true, data: { eyebrow: null, title: "Khách hàng nói gì", limit: 6 } };
    case "partners": return { type, isEnabled: true, data: { eyebrow: null, title: "Đối tác và khách hàng", kind: "all", limit: 12 } };
    case "featured_posts": return { type, isEnabled: true, data: { eyebrow: null, title: "Bài viết nổi bật", limit: 3 } };
    case "faq": return { type, isEnabled: true, data: { eyebrow: null, title: "Câu hỏi thường gặp", items: [{ question: "Câu hỏi mới", answer: "Nội dung trả lời" }] } };
    case "cta": return { type, isEnabled: true, data: { id: null, eyebrow: null, title: "Sẵn sàng bắt đầu?", action: { label: "Liên hệ tư vấn", href: "/lien-he" } } };
    case "lead_form": return { type, isEnabled: true, data: { title: "Nhận tư vấn", description: null, submitLabel: "Gửi yêu cầu", needOptions: [] } };
    case "rich_text": return { type, isEnabled: true, data: { heading: null, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nội dung mới" }] }] } } };
    case "image": return { type, isEnabled: true, data: { mediaId: "", alt: null, caption: null } };
    case "video": return { type, isEnabled: true, data: { eyebrow: null, title: null, description: null, url: "", caption: null } };
    case "download_list": return { type, isEnabled: true, data: { eyebrow: null, title: "Tài liệu tải về" } };
    case "media_text": return { type, isEnabled: true, data: { layout: "image_right", tone: "light", eyebrow: null, title: "Tiêu đề mới", description: null, bullets: [], mediaId: null, primaryAction: null, secondaryAction: null } };
    case "pricing": return { type, isEnabled: true, data: { eyebrow: null, title: "Bảng giá", description: null, note: null, plans: [{ name: "Cơ bản", price: "Liên hệ", period: null, description: null, features: ["Tính năng 1"], action: { label: "Đăng ký", href: "/lien-he" }, highlighted: false, badge: null }] } };
    case "columns": return { type, isEnabled: true, data: { eyebrow: null, title: null, layout: "equal", gap: "md", verticalAlign: "center", stack: "normal", columns: [{ items: [newColumnItem("heading"), newColumnItem("text")] }, { items: [newColumnItem("image")] }] } };
    case "grouped_list": return { type, isEnabled: true, data: { eyebrow: "Theo ngành hàng", title: "Phù hợp nhiều mô hình kinh doanh", description: null, groupLabel: "Nhóm ngành", showCount: true, groups: [{ title: "Bán buôn, bán lẻ", icon: "store", items: [{ label: "Thời trang", icon: "shirt", href: null }, { label: "Tạp hóa & siêu thị", icon: "shopping-cart", href: null }], action: { label: "Tư vấn triển khai theo mô hình", href: "/lien-he" } }] } };
    case "collection_list": return { type, isEnabled: true, data: { source: "posts", eyebrow: null, title: "Bài viết mới nhất", description: null, limit: 6, anchor: null } };
  }
}

function typedNewBlock<Type extends BlockType>(type: Type) {
  return newBlock(type) as Extract<PageBlock, { type: Type }>;
}

function libraryBlock(id: string): PageBlock {
  switch (id) {
    case "columns-two-wide": { const block = newBlock("columns"); return block.type === "columns" ? { ...block, data: { ...block.data, layout: "left_wide" } } : block; }
    case "columns-three": { const block = newBlock("columns"); return block.type === "columns" ? { ...block, data: { ...block.data, columns: [0, 1, 2].map(() => ({ items: [newColumnItem("heading"), newColumnItem("text")] })) } } : block; }
    case "columns-four": { const block = newBlock("columns"); return block.type === "columns" ? { ...block, data: { ...block.data, columns: [0, 1, 2, 3].map(() => ({ items: [newColumnItem("heading"), newColumnItem("text")] })) } } : block; }
    case "hero-background": { const block = typedNewBlock("hero"); return { ...block, data: { ...block.data, layout: "background", tone: "dark" } }; }
    case "hero-centered": { const block = typedNewBlock("hero"); return { ...block, data: { ...block.data, layout: "centered" } }; }
    case "media-right": { const block = typedNewBlock("media_text"); return { ...block, data: { ...block.data, layout: "image_right" } }; }
    case "media-left":
    case "media-story": { const block = typedNewBlock("media_text"); return { ...block, data: { ...block.data, layout: "image_left" } }; }
    case "features-compact": { const block = newBlock("features"); return block.type === "features" ? { ...block, data: { ...block.data, cardStyle: "compact" } } : block; }
    case "features-visual": { const block = newBlock("features"); return block.type === "features" ? { ...block, data: { ...block.data, cardStyle: "visual" } } : block; }
    case "collection-software": { const block = typedNewBlock("collection_list"); return { ...block, data: { ...block.data, source: "software", title: "Phần mềm nổi bật" } }; }
    case "collection-solution": { const block = typedNewBlock("collection_list"); return { ...block, data: { ...block.data, source: "solution", title: "Giải pháp nổi bật" } }; }
    case "partners": { const block = typedNewBlock("partners"); return { ...block, data: { ...block.data, kind: "partner", title: "Đối tác" } }; }
    case "customers": { const block = typedNewBlock("partners"); return { ...block, data: { ...block.data, kind: "customer", title: "Khách hàng" } }; }
    case "cta-trial": { const block = typedNewBlock("cta"); return { ...block, data: { ...block.data, title: "Sẵn sàng dùng thử?", action: { label: "Đăng ký dùng thử", href: settingLinkHref("trial") } } }; }
    default: {
      const option = libraryBlockOptions.find((item) => item.id === id);
      return newBlock(option?.type ?? "rich_text");
    }
  }
}

/** Bản sao danh sách với một mục được vá vài trường — thay cho map lặp lại ở mọi danh sách con. */
function patchAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
}

// Dời mục đi `delta` vị trí (kéo thả có thể đi nhiều bước một lần; phím tắt đi một bước).
function changePosition<T>(items: T[], index: number, delta: number) {
  return moveListItem(items, index, delta);
}

// `field`: mã trường (khóa dữ liệu) để canvas chỉ đúng ô này khi bấm vào chữ tương ứng trên trang (data-field ↔ data-builder-field).
function Field({ label, value, onChange, multiline = false, type = "text", min, field }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; type?: "text" | "url" | "number"; min?: number; field?: string }) {
  return <label className="admin-field" data-field={field}>{label}{multiline ? <textarea className="min-h-24" value={value} onChange={event => onChange(event.target.value)} /> : <input type={type} min={min} value={value} onChange={event => onChange(event.target.value)} />}</label>;
}

function NullableField({ label, value, onChange, multiline = false, type = "text", field }: { label: string; value: string | null; onChange: (value: string | null) => void; multiline?: boolean; type?: "text" | "url"; field?: string }) {
  return <Field field={field} label={label} value={value ?? ""} multiline={multiline} type={type} onChange={next => onChange(next === "" ? null : next)} />;
}

function NumberField({ label, value, onChange, max, field }: { label: string; value: number; onChange: (value: number) => void; max?: number; field?: string }) {
  return <Field field={field} label={label} type="number" min={1} value={String(value)} onChange={next => onChange(Math.max(1, Math.min(max ?? Number.MAX_SAFE_INTEGER, Number(next) || 1)))} />;
}

/** Bộ ba Dòng giới thiệu · Tiêu đề · Mô tả lặp ở hầu hết loại khối; bỏ prop `description` với khối không có mô tả. */
type IntroPatch = { eyebrow?: string | null; title?: string; description?: string | null };
function IntroFields({ eyebrow, title, description, onPatch }: { eyebrow: string | null; title: string; description?: string | null; onPatch: (patch: IntroPatch) => void }) {
  return <>
    <div className="contents" data-field="eyebrow"><NullableField label="Dòng giới thiệu" value={eyebrow} onChange={eyebrow => onPatch({ eyebrow })} /></div>
    <div className="contents" data-field="title"><Field label="Tiêu đề" value={title} onChange={title => onPatch({ title })} /></div>
    {description !== undefined ? <div className="contents" data-field="description"><NullableField label="Mô tả" multiline value={description} onChange={description => onPatch({ description })} /></div> : null}
  </>;
}

function Section({ title, children, field }: { title: string; children: ReactNode; field?: string }) {
  return <fieldset className="admin-block-group" data-builder-collection={title} data-field={field}><legend>{title}</legend>{children}</fieldset>;
}

/**
 * Một mục trong danh sách lặp (ảnh, khối, thẻ, gói, nhóm…). Dòng đầu có số thứ tự, tên loại
 * để phân biệt nhanh; nội dung nhập chỉ xuất hiện trong trường chỉnh sửa, không lặp trong tiêu đề.
 */
function ListItem({ noun, number, index, length, onMove, onDelete, children, field }: { noun: string; number?: number; summary?: string | null; index: number; length: number; onMove?: (delta: number) => void; onDelete?: () => void; children: ReactNode; field?: string }) {
  const order = number ?? index + 1;
  return <section aria-label={`${noun} ${order}`} className="admin-list-item" data-builder-item={index} data-field={field}>
    <div className="admin-list-item__head">
      <span aria-hidden="true" className="admin-list-item__index">{order}</span>
      <span className="admin-list-item__title"><strong>{noun}</strong></span>
      {onMove && onDelete ? <AdminListRowControls index={index} label={`${noun.toLowerCase()} ${order}`} length={length} onMove={onMove} onRemove={onDelete} /> : null}
    </div>
    {children}
  </section>;
}

function ActionFields({ title, value, onChange, optional = true, field }: { title: string; value: Action | null; onChange: (value: Action | null) => void; optional?: boolean; field?: string }) {
  const active = value !== null;
  return <Section field={field} title={title}>{optional ? <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={event => onChange(event.target.checked ? { label: "Xem thêm", href: "/lien-he" } : null)} />Hiển thị nút này</label> : null}{active ? <ActionTarget value={value} onChange={onChange} /> : null}</Section>;
}

// Nút dẫn tới đường dẫn tự nhập hoặc tới một liên kết trong Cài đặt (lưu mã `setting:trial`, website tự đổi sang địa chỉ hiện tại).
function ActionTarget({ value, onChange }: { value: Action; onChange: (value: Action) => void }) {
  const settingKey = settingLinkKey(value.href);
  const setTarget = (target: string) => onChange({ ...value, href: target === "custom" ? "/lien-he" : settingLinkHref(target as SettingLinkKey) });
  return <><div className="admin-form-grid"><Field label="Nhãn nút" value={value.label} onChange={label => onChange({ ...value, label })} /><label className="admin-field">Dẫn tới<select value={settingKey ?? "custom"} onChange={event => setTarget(event.target.value)}><option value="custom">Đường dẫn tự nhập</option>{settingLinkOptions.map(option => <option key={option.key} value={option.key}>{option.label} (theo Cài đặt)</option>)}</select></label></div>
    {settingKey ? <p className="admin-help">Địa chỉ lấy từ Cài đặt › Liên kết ngoài, đổi ở đó là mọi nút cùng loại đổi theo. Chưa nhập địa chỉ thì nút dẫn về trang Liên hệ.</p> : <Field label="Đường dẫn (ví dụ /lien-he hoặc https://...)" value={value.href} onChange={href => onChange({ ...value, href })} />}</>;
}

type CardStyle = NonNullable<CardBlock["data"]["cardStyle"]>;
const cardStyleOptions: ReadonlyArray<LayoutOption<CardStyle>> = [
  { value: "compact", label: "Thẻ gọn", hint: "Biểu tượng nhỏ, tiêu đề, mô tả. Có thẻ nào chọn ảnh thì cả lưới tự thành thẻ ảnh. Đặt nền “Tối” thì website vẽ thành hai cột: tiêu đề bên trái, các ý bên phải (hợp với “Vì sao chọn chúng tôi”).", preview: cardStylePreviews.compact },
  { value: "visual", label: "Thẻ ảnh", hint: "Ảnh ngang sát mép trên mỗi thẻ; thẻ chưa có ảnh hiện biểu tượng lớn trên nền xanh nhạt.", preview: cardStylePreviews.visual },
  { value: "bento", label: "Thẻ lớn nổi bật", hint: "Thẻ 1 to bên trái (ảnh lớn phía trên, tiêu đề to), 4 thẻ nhỏ xếp hai cột bên phải. Cần đúng 5 thẻ; hợp với phần giới thiệu các mảng sản phẩm.", preview: cardStylePreviews.bento },
];

function CardStyleField({ block, onChange }: { block: CardBlock; onChange: (block: PageBlock) => void }) {
  const style = block.data.cardStyle ?? "compact";
  const count = block.data.items.length;
  // Nền "Tối" hoặc màu tự chọn đủ tối (website dùng chữ trắng) cùng một cách vẽ.
  const dark = block.appearance?.tone === "dark" || (block.appearance?.tone === "custom" && Boolean(block.appearance.backgroundColor && isDarkColor(block.appearance.backgroundColor)));
  return <>
    <LayoutPicker label="Kiểu thẻ" name={`card-style-${useId()}`} onChange={cardStyle => onChange({ ...block, data: { ...block.data, cardStyle } })} options={cardStyleOptions} value={style} />
    {style === "bento" && count !== 5 ? <p className="admin-help admin-text-warning">Kiểu này cần đúng 5 thẻ (đang có {count}); website sẽ vẽ như “Thẻ ảnh” cho tới khi đủ 5.</p> : null}
    {dark && style !== "compact" ? <p className="admin-help">Trên nền tối, chỉ kiểu “Thẻ gọn” (không ảnh) mới vẽ thành hai cột; kiểu này vẫn hiện thành hàng thẻ.</p> : null}
  </>;
}

// `bento`: ghi rõ thẻ 1 là thẻ lớn để người vận hành biết nên đặt nội dung chính và ảnh đẹp nhất ở đâu.
// Màu nền riêng của một thẻ con (thẻ lưới, gói giá, nhóm); "Mặc định" = thẻ trắng.
function CardColor({ value, onChange, disabled }: { value: string | null | undefined; onChange: (value: string | null) => void; disabled?: boolean }) {
  return <div className="admin-field"><ColorPicker allowNone disabled={disabled} label="Màu nền thẻ" onChange={onChange} value={value ?? null} />{value ? <small className="admin-help">{isDarkColor(value) ? "Màu tối: chữ trong thẻ tự chuyển sang trắng." : "Màu sáng: chữ đậm như bình thường."}</small> : null}</div>;
}

function CardItemsEditor({ items, onChange, showIcons, disabled, onUploadingChange, bento = false }: { items: CardBlock["data"]["items"]; onChange: (items: CardBlock["data"]["items"]) => void; showIcons: boolean; disabled?: boolean; onUploadingChange: (pending: boolean) => void; bento?: boolean }) {
  return <Section title={`Các thẻ (${items.length})`}>{items.map((item, index) => <ListItem index={index} key={index} length={items.length} noun="Thẻ" onDelete={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} onMove={direction => onChange(changePosition(items, index, direction))} summary={bento && index === 0 ? `Thẻ lớn · ${item.title}` : item.title}>{showIcons ? <div className="admin-field">Biểu tượng (để trống: hiện số thứ tự)<IconPicker label={`Biểu tượng thẻ ${index + 1}`} onChange={icon => onChange(patchAt(items, index, { icon }))} value={item.icon ?? null} /></div> : null}{showIcons ? <MediaPicker disabled={disabled} hint="Không bắt buộc. Có ảnh thì thẻ hiện thành thẻ ảnh (ảnh ngang, tỉ lệ 16:10, rộng từ 800px); không có ảnh thì dùng biểu tượng." label={`Ảnh thẻ ${index + 1}`} onUploadingChange={onUploadingChange} preview value={item.mediaId ?? null} onChange={mediaId => onChange(patchAt(items, index, { mediaId }))} /> : null}<div className="admin-form-grid"><Field label="Tiêu đề" value={item.title} onChange={title => onChange(patchAt(items, index, { title }))} /><NullableField label="Đường dẫn (ví dụ /lien-he hoặc https://...)" value={item.href} onChange={href => onChange(patchAt(items, index, { href }))} /></div><Field label="Mô tả" multiline value={item.description} onChange={description => onChange(patchAt(items, index, { description }))} />{showIcons ? <CardColor disabled={disabled} onChange={background => onChange(patchAt(items, index, { background }))} value={item.background} /> : null}</ListItem>)}<button type="button" onClick={() => onChange([...items, { title: "Mục mới", description: "Mô tả", href: null }])}>Thêm mục</button></Section>;
}

type HeroBlock = Extract<PageBlock, { type: "hero" }>;

// Ảnh trượt/ảnh thêm chưa chọn ảnh vẫn giữ trong form để chọn tiếp, nhưng bỏ khi lưu (schema bắt buộc mediaId).
// Ô ảnh đầu bị bỏ trống thì ảnh kế tiếp lên thay.
export function withoutEmptyHeroSlides(blocks: PageBlock[]): PageBlock[] {
  return blocks.map(block => {
    if (block.type !== "hero") return block;
    const images = heroImages(block.data).filter(Boolean);
    // Khối nội dung trượt chưa có tiêu đề bị bỏ khi lưu (form đã cảnh báo).
    return { ...block, data: { ...block.data, slides: block.data.slides.filter(slide => slide.mediaId), mediaId: images[0] ?? null, extraMediaIds: images.slice(1), panels: (block.data.panels ?? []).filter(panel => panel.title.trim()) } };
  });
}
const maxHeroImages = 8;
function heroImages(data: HeroBlock["data"]) {
  // Dữ liệu cũ có thể chưa có `extraMediaIds`.
  return [data.mediaId ?? "", ...(data.extraMediaIds ?? [])];
}
type HeroLayout = HeroBlock["data"]["layout"];
export const heroLayoutOptions: ReadonlyArray<LayoutOption<HeroLayout>> = [
  { value: "split", label: "Chữ trái, ảnh phải", hint: "Tiêu đề và nút bên trái, ảnh sản phẩm bên phải. Hợp với giới thiệu phần mềm.", preview: heroLayoutPreviews.split },
  { value: "split_reverse", label: "Ảnh trái, chữ phải", hint: "Như kiểu trên nhưng ảnh nằm bên trái.", preview: heroLayoutPreviews.split_reverse },
  { value: "background", label: "Ảnh nền tràn màn hình", hint: "Ảnh phủ kín bề ngang, chữ đè lên. Có lớp phủ trắng, xanh biển nhạt hoặc tối (chữ trắng) để chữ dễ đọc. Hợp với ảnh không gian, công trình.", preview: heroLayoutPreviews.background },
  { value: "slider", label: "Trượt nhiều ảnh", hint: "Nhiều ảnh tự chuyển, có mũi tên và chấm. Mỗi ảnh có thể kèm chữ và nút riêng, hoặc dùng ảnh banner đã có sẵn chữ.", preview: heroLayoutPreviews.slider },
  { value: "centered", label: "Chữ ở giữa", hint: "Tiêu đề căn giữa, ảnh (nếu có) nằm bên dưới. Hợp với trang ngắn, trang giới thiệu.", preview: heroLayoutPreviews.centered },
];
const heroImageHints: Record<Exclude<HeroLayout, "slider">, { label: string; hint: string }> = {
  split: { label: "Ảnh bên phải (tùy chọn)", hint: "Hiện bên phải tiêu đề trên máy tính, phía dưới trên điện thoại. Nên dùng ảnh ngang hoặc ảnh nền trong suốt, rộng từ 1200px." },
  split_reverse: { label: "Ảnh bên trái (tùy chọn)", hint: "Hiện bên trái tiêu đề trên máy tính, phía trên trên điện thoại. Rộng từ 1200px." },
  background: { label: "Ảnh nền", hint: "Ảnh ngang, rộng từ 1920px. Phần giữa-trái nên thoáng để chữ dễ đọc." },
  centered: { label: "Ảnh bên dưới chữ (tùy chọn)", hint: "Ảnh ngang hiện dưới tiêu đề, ví dụ ảnh chụp màn hình sản phẩm." },
};

// Màu nền phần đầu trang; với kiểu ảnh nền là màu lớp phủ lên ảnh (nền sáng thì chữ đậm, nền tối thì chữ trắng).
// "Màu tự chọn…" lưu ở vỏ chung (appearance.tone = custom + backgroundColor): màu tối thì chữ, nút và menu phía trên tự chuyển sáng.
function HeroToneField({ block, onChange, disabled }: { block: HeroBlock; onChange: (block: PageBlock) => void; disabled?: boolean }) {
  const data = block.data;
  const background = data.layout === "background";
  const appearance = { ...defaultAppearance, ...block.appearance };
  const custom = appearance.tone === "custom";
  const color = appearance.backgroundColor ?? colorSwatches[1].value;
  function choose(value: string) {
    if (value === "custom") onChange({ ...block, appearance: { ...appearance, tone: "custom", backgroundColor: color } });
    else onChange({ ...block, data: { ...data, tone: value as HeroTone }, appearance: { ...appearance, tone: "auto" } });
  }
  return <div className="admin-field">
    <label className="admin-field">{background ? "Lớp phủ lên ảnh" : "Màu nền"}<select className="admin-input" disabled={disabled} onChange={event => choose(event.target.value)} value={custom ? "custom" : heroToneOf(data)}>
      <option value="light">{background ? "Trắng (chữ đậm)" : "Trắng"}</option>
      <option value="tinted">{background ? "Xanh biển nhạt (chữ đậm)" : "Xanh biển nhạt"}</option>
      {background ? <option value="dark">Tối (chữ trắng)</option> : null}
      <option value="custom">Màu tự chọn…</option>
    </select></label>
    {custom ? <>
      <ColorPicker disabled={disabled} label={background ? "Màu lớp phủ" : "Màu nền tự chọn"} onChange={next => onChange({ ...block, appearance: { ...appearance, tone: "custom", backgroundColor: next ?? color } })} value={color} />
      <small className="admin-help">{isDarkColor(color) ? "Màu tối: chữ, nút và menu phía trên tự chuyển sang màu sáng." : "Màu sáng: chữ đậm như bình thường."}{background ? " Độ đậm lớp phủ chỉnh ở mục Giao diện phần đầu trang bên dưới." : ""}</small>
    </> : null}
  </div>;
}

// Ảnh của các kiểu chữ – ảnh, ảnh nền, chữ ở giữa: ô đầu là `mediaId`, các ô sau là `extraMediaIds`.
function HeroImagesFields({ data, set, disabled, onUploadingChange }: { data: HeroBlock["data"]; set: (patch: Partial<HeroBlock["data"]>) => void; disabled?: boolean; onUploadingChange: (pending: boolean) => void }) {
  const hint = data.layout === "slider" ? null : heroImageHints[data.layout];
  if (!hint) return null;
  const images = heroImages(data);
  const setImages = (next: string[]) => set({ mediaId: next[0] || null, extraMediaIds: next.slice(1) });
  const chosen = images.filter(Boolean).length;
  // Có khối nội dung trượt thì mỗi khối dùng một ảnh của riêng nó; khối 1 chỉ dùng ảnh đầu.
  const panelMode = (data.panels ?? []).length > 0;
  const shown = panelMode ? images.slice(0, 1) : images;
  return <Section field="image" title={panelMode ? `${hint.label} — khối 1` : `${hint.label} (${images.length}/${maxHeroImages})`}>
    <p className="admin-help">{hint.hint} {panelMode ? "Đang dùng khối nội dung trượt: mỗi khối có một ảnh riêng." : "Có từ 2 ảnh thì website tự chuyển ảnh sau vài giây (chữ giữ nguyên), kèm chấm để xem từng ảnh."}</p>
    {panelMode && images.length > 1 ? <p className="admin-help admin-text-warning">Các ảnh thêm của khối 1 không hiện khi có khối nội dung trượt.</p> : null}
    {shown.map((mediaId, index) => <ListItem index={index} key={index} length={images.length} noun="Ảnh" onDelete={shown.length > 1 ? () => setImages(images.filter((_, entryIndex) => entryIndex !== index)) : undefined} onMove={shown.length > 1 ? direction => setImages(changePosition(images, index, direction)) : undefined} summary={mediaId ? null : "Chưa chọn ảnh"}>
      <MediaPicker compact disabled={disabled} label={`Ảnh ${index + 1}`} onUploadingChange={onUploadingChange} preview value={mediaId || null} onChange={next => setImages(images.map((entry, entryIndex) => entryIndex === index ? next ?? "" : entry))} />
      {index > 0 && !mediaId ? <p className="admin-help admin-text-warning">Chưa chọn ảnh: ô này sẽ bị bỏ khi lưu.</p> : null}
    </ListItem>)}
    {data.layout === "background" && chosen === 0 ? <p className="admin-help admin-text-warning">Kiểu này cần ảnh nền; chưa có ảnh thì website hiện nền màu.</p> : null}
    {!panelMode && images.length < maxHeroImages ? <button type="button" onClick={() => setImages([...images, ""])}>Thêm ảnh</button> : null}
  </Section>;
}

type HeroPanel = HeroBlock["data"]["panels"][number];
const maxHeroPanels = 7;
function HeroHighlightsFields({ title, items, onChange }: { title: string; items: HeroBlock["data"]["highlights"]; onChange: (items: HeroBlock["data"]["highlights"]) => void }) {
  return <Section title={title}>
    <p className="admin-help">Tối đa 4 điểm nổi bật. Mỗi điểm có một dòng chính và dòng phụ tùy chọn.</p>
    {items.map((item, index) => <ListItem index={index} key={index} length={items.length} noun="Điểm nổi bật" onDelete={() => onChange(items.filter((_, current) => current !== index))} onMove={direction => onChange(changePosition(items, index, direction))} summary={item.title}>
      <div className="admin-form-grid"><Field field="title" label="Điểm nổi bật" value={item.title} onChange={title => onChange(patchAt(items, index, { title }))} /><NullableField field="note" label="Dòng phụ" value={item.note} onChange={note => onChange(patchAt(items, index, { note }))} /></div>
    </ListItem>)}
    <button disabled={items.length >= 4} type="button" onClick={() => onChange([...items, { title: "Điểm nổi bật mới", note: null }])}>Thêm điểm nổi bật</button>
  </Section>;
}
// Khối nội dung trượt: khối 1 là các ô phía trên; mỗi khối thêm có chữ, nút và ảnh riêng, website trượt lần lượt.
function HeroPanelsFields({ data, set, disabled, onUploadingChange }: { data: HeroBlock["data"]; set: (patch: Partial<HeroBlock["data"]>) => void; disabled?: boolean; onUploadingChange: (pending: boolean) => void }) {
  const panels = data.panels ?? [];
  const setPanel = (index: number, patch: Partial<HeroPanel>) => set({ panels: patchAt(panels, index, patch) });
  const imageLabel = data.layout === "background" ? "Ảnh nền của khối" : "Ảnh của khối";
  return <Section title={`Các mục trượt bổ sung (${panels.length}/${maxHeroPanels})`}>
    <p className="admin-help">Mục đầu tiên là nội dung chính phía trên. Các mục bổ sung bên dưới luân phiên cả chữ và ảnh (6 giây mỗi mục). Đây là nội dung con của Phần đầu trang; để thêm một phần mới vào trang, dùng Thêm thành phần ở cột bên phải.</p>
    {panels.map((panel, index) => <ListItem index={index} key={index} length={panels.length} noun="Khối" number={index + 2} onDelete={() => set({ panels: panels.filter((_, panelIndex) => panelIndex !== index) })} onMove={direction => set({ panels: changePosition(panels, index, direction) })} summary={panel.title}>
      <div className="admin-form-grid"><NullableField field="eyebrow" label="Dòng giới thiệu" value={panel.eyebrow} onChange={eyebrow => setPanel(index, { eyebrow })} /><Field field="title" label="Tiêu đề" value={panel.title} onChange={title => setPanel(index, { title })} /></div>
      {panel.title.trim() ? null : <p className="admin-help admin-text-warning">Khối chưa có tiêu đề sẽ bị bỏ khi lưu.</p>}
      <div className="contents" data-field="image"><MediaPicker disabled={disabled} label={imageLabel} onUploadingChange={onUploadingChange} preview value={panel.mediaId} onChange={mediaId => setPanel(index, { mediaId })} /></div>
      <NullableField field="description" label="Mô tả" multiline value={panel.description} onChange={description => setPanel(index, { description })} />
      <label className="admin-check"><input checked={panel.highlights === undefined} onChange={event => setPanel(index, { highlights: event.target.checked ? undefined : structuredClone(data.highlights) })} type="checkbox" />Dùng điểm nổi bật chung của phần đầu trang</label>
      <HeroHighlightsFields title={`Điểm nổi bật của mục ${index + 2}`} items={panel.highlights ?? data.highlights} onChange={highlights => setPanel(index, { highlights })} />
      <ActionFields field="primaryAction" title="Nút chính" value={panel.primaryAction} onChange={primaryAction => setPanel(index, { primaryAction })} />
      <ActionFields field="secondaryAction" title="Nút phụ" value={panel.secondaryAction} onChange={secondaryAction => setPanel(index, { secondaryAction })} />
    </ListItem>)}
    {panels.length < maxHeroPanels ? <button type="button" onClick={() => set({ panels: [...panels, { eyebrow: data.eyebrow, title: "Tiêu đề mục trượt mới", description: null, primaryAction: data.primaryAction, secondaryAction: null, mediaId: null, highlights: [] }] })}>Thêm mục trượt</button> : null}
  </Section>;
}

function HeroFields({ block, onChange, disabled, onUploadingChange, part }: { block: HeroBlock; onChange: (block: PageBlock) => void; disabled?: boolean; onUploadingChange: (pending: boolean) => void; part: "content" | "media" }) {
  const data = block.data;
  const set = (patch: Partial<HeroBlock["data"]>) => onChange({ ...block, data: { ...data, ...patch } });
  const slider = data.layout === "slider";
  const layoutName = `hero-layout-${useId()}`;
  if (part === "media") return <>
    <p className="admin-help">Bố cục này áp dụng chung cho các mục trượt. Chữ, ảnh và điểm nổi bật được sửa trong từng mục ở cây bên phải.</p>
    <LayoutPicker label="Kiểu bố cục" name={layoutName} onChange={layout => set({ layout })} options={heroLayoutOptions} value={data.layout} />
    {slider ? <Field field="title" label="Tiêu đề (cho Google; trên website chỉ hiện chữ của từng ảnh)" value={data.title} onChange={title => set({ title })} /> : null}
  </>;
  if (slider) return <>
    <NullableField field="eyebrow" label="Dòng giới thiệu" value={data.eyebrow} onChange={eyebrow => set({ eyebrow })} />
    <Field field="title" label="Tiêu đề (cho Google; trên website chỉ hiện chữ của từng ảnh)" value={data.title} onChange={title => set({ title })} />
    <HeroSlidesFields data={data} disabled={disabled} onUploadingChange={onUploadingChange} set={set} />
  </>;
  return <>
    <Section title="Mục trượt 1">
      <NullableField field="eyebrow" label="Dòng giới thiệu" value={data.eyebrow} onChange={eyebrow => set({ eyebrow })} />
      <Field field="title" label="Tiêu đề" value={data.title} onChange={title => set({ title })} />
      <HeroImagesFields data={data} disabled={disabled} onUploadingChange={onUploadingChange} set={set} />
      <NullableField field="description" label="Mô tả" multiline value={data.description} onChange={description => set({ description })} />
      <HeroHighlightsFields title="Điểm nổi bật của mục 1" items={data.highlights} onChange={highlights => set({ highlights })} />
      <ActionFields field="primaryAction" title="Nút chính" value={data.primaryAction} onChange={primaryAction => set({ primaryAction })} />
      <ActionFields field="secondaryAction" title="Nút phụ" value={data.secondaryAction} onChange={secondaryAction => set({ secondaryAction })} />
      <NullableField field="footnote" label="Dòng ghi chú dưới nút (ví dụ: Dùng thử miễn phí 15 ngày)" value={data.footnote} onChange={footnote => set({ footnote })} />
    </Section>
    <HeroPanelsFields data={data} disabled={disabled} onUploadingChange={onUploadingChange} set={set} />
  </>;
}

// Các ảnh trượt, chữ và nút của từng mục thuộc tab Nội dung.
function HeroSlidesFields({ data, set, disabled, onUploadingChange }: { data: HeroBlock["data"]; set: (patch: Partial<HeroBlock["data"]>) => void; disabled?: boolean; onUploadingChange: (pending: boolean) => void }) {
  const slides = data.slides;
  const setSlide = (index: number, patch: Partial<HeroBlock["data"]["slides"][number]>) => set({ slides: patchAt(slides, index, patch) });
  return <>
    {<Section title={`Các ảnh trượt (${slides.length}/8)`}>
      {slides.length === 0 ? <p className="admin-help admin-text-warning">Chưa có ảnh nào: website sẽ hiện tiêu đề trên nền màu.</p> : null}
      {slides.map((slide, index) => <ListItem index={index} key={index} length={slides.length} noun="Ảnh trượt" onDelete={() => set({ slides: slides.filter((_, slideIndex) => slideIndex !== index) })} onMove={direction => set({ slides: changePosition(slides, index, direction) })} summary={slide.title}>
        <div className="contents" data-field="image"><MediaPicker compact disabled={disabled} hint="Ảnh ngang, rộng từ 1920px. Ảnh banner đã có chữ thì để trống các ô chữ bên dưới." label={`Ảnh trượt ${index + 1}`} onUploadingChange={onUploadingChange} preview value={slide.mediaId || null} onChange={mediaId => setSlide(index, { mediaId: mediaId ?? "" })} /></div>
        {slide.mediaId ? null : <p className="admin-help admin-text-warning">Chưa chọn ảnh: ảnh trượt này sẽ bị bỏ khi lưu.</p>}
        <div className="admin-form-grid"><NullableField field="title" label="Chữ lớn trên ảnh (tùy chọn)" value={slide.title} onChange={title => setSlide(index, { title })} /><NullableField field="description" label="Mô tả ngắn (tùy chọn)" value={slide.description} onChange={description => setSlide(index, { description })} /></div>
        <ActionFields field="action" title="Nút trên ảnh" value={slide.action} onChange={action => setSlide(index, { action })} />
        
      </ListItem>)}
      {slides.length < 8 ? <button type="button" onClick={() => set({ slides: [...slides, { mediaId: "", title: null, description: null, action: null }] })}>Thêm ảnh trượt</button> : null}
    </Section>}
  </>;
}

type MediaTextBlock = Extract<PageBlock, { type: "media_text" }>;
type ColumnsBlock = Extract<PageBlock, { type: "columns" }>;
const columnItemKinds: ReadonlyArray<{ kind: ColumnItem["kind"]; label: string }> = [
  { kind: "heading", label: "Tiêu đề" }, { kind: "text", label: "Đoạn văn" }, { kind: "image", label: "Ảnh" }, { kind: "button", label: "Nút" }, { kind: "list", label: "Danh sách ✓" },
];
function newColumnItem(kind: ColumnItem["kind"]): ColumnItem {
  switch (kind) {
    case "heading": return { kind, text: "Tiêu đề mới", level: "h3", align: "left" };
    case "text": return { kind, text: "Nội dung mới", align: "left" };
    case "image": return { kind, mediaId: null, alt: null, fit: "contain" };
    case "button": return { kind, label: "Nút mới", href: "/lien-he", style: "primary" };
    case "list": return { kind, items: ["Mục đầu tiên"] };
  }
}
const alignOptions = [["left", "Trái"], ["center", "Giữa"], ["right", "Phải"]] as const;

function ColumnItemFields({ item, onChange, disabled, onUploadingChange }: { item: ColumnItem; onChange: (item: ColumnItem) => void; disabled?: boolean; onUploadingChange: (pending: boolean) => void }) {
  const align = (value: "left" | "center" | "right", apply: (next: "left" | "center" | "right") => ColumnItem) => <label className="admin-field">Căn chữ<select disabled={disabled} onChange={event => onChange(apply(event.target.value as "left" | "center" | "right"))} value={value}>{alignOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>;
  switch (item.kind) {
    case "heading": return <>
      <Field label="Chữ tiêu đề" value={item.text} onChange={text => onChange({ ...item, text })} />
      <div className="admin-form-grid">
        <label className="admin-field">Cỡ chữ<select disabled={disabled} onChange={event => onChange({ ...item, level: event.target.value as typeof item.level })} value={item.level}><option value="h2">Lớn</option><option value="h3">Vừa</option><option value="h4">Nhỏ</option></select></label>
        {align(item.align, next => ({ ...item, align: next }))}
      </div>
    </>;
    case "text": return <>
      <Field label="Nội dung" multiline value={item.text} onChange={text => onChange({ ...item, text })} />
      {align(item.align, next => ({ ...item, align: next }))}
    </>;
    case "image": return <>
      <div className="contents" data-field="image"><MediaPicker compact disabled={disabled} label="Ảnh" onUploadingChange={onUploadingChange} preview value={item.mediaId} onChange={mediaId => onChange({ ...item, mediaId })} /></div>
      <NullableField field="alt" label="Mô tả ảnh (cho người khiếm thị và SEO)" value={item.alt} onChange={alt => onChange({ ...item, alt })} />
      <label className="admin-field">Cách hiển thị<select disabled={disabled} onChange={event => onChange({ ...item, fit: event.target.value as typeof item.fit })} value={item.fit}><option value="contain">Vừa khung (giữ nguyên tỉ lệ)</option><option value="cover">Phủ kín khung 4:3</option></select></label>
    </>;
    case "button": return <>
      <div className="admin-form-grid">
        <Field field="label" label="Chữ trên nút" value={item.label} onChange={label => onChange({ ...item, label })} />
        <Field field="href" label="Dẫn tới (/lien-he hoặc https://…)" value={item.href} onChange={href => onChange({ ...item, href })} />
      </div>
      <label className="admin-field">Kiểu nút<select disabled={disabled} onChange={event => onChange({ ...item, style: event.target.value as typeof item.style })} value={item.style}><option value="primary">Nút chính</option><option value="secondary">Nút phụ</option></select></label>
    </>;
    case "list": return <AdminListEditor addLabel="Thêm dòng" itemLabel="Dòng" items={item.items} maxItems={12} maxLength={200} onChange={items => onChange({ ...item, items })} placeholder="Ví dụ: Báo cáo doanh thu theo thời gian thực" />;
  }
}

const columnsRatioOptions = [["equal", "Hai cột đều nhau (50/50)"], ["left_wide", "Cột trái rộng hơn (60/40)"], ["right_wide", "Cột phải rộng hơn (40/60)"]] as const;

function ColumnsFields({ block, onChange, disabled, onUploadingChange }: { block: ColumnsBlock; onChange: (block: PageBlock) => void; disabled?: boolean; onUploadingChange: (pending: boolean) => void }) {
  const data = block.data;
  const set = (patch: Partial<ColumnsBlock["data"]>) => onChange({ ...block, data: { ...data, ...patch } });
  const setItems = (columnIndex: number, items: ColumnItem[]) => set({ columns: data.columns.map((column, index) => index === columnIndex ? { items } : column) });
  function setCount(count: number) {
    if (count === data.columns.length) return;
    if (count > data.columns.length) { set({ columns: [...data.columns, ...Array.from({ length: count - data.columns.length }, () => ({ items: [] as ColumnItem[] }))] }); return; }
    // Bớt cột: nội dung của cột bị bỏ được dồn vào cột cuối còn lại để không mất dữ liệu (tối đa 12 mục mỗi cột).
    const kept = data.columns.slice(0, count);
    kept[count - 1] = { items: [...kept[count - 1].items, ...data.columns.slice(count).flatMap(column => column.items)].slice(0, 12) };
    set({ columns: kept });
  }
  return <>
    <NullableField field="eyebrow" label="Dòng giới thiệu (tùy chọn)" value={data.eyebrow} onChange={eyebrow => set({ eyebrow })} />
    <NullableField field="title" label="Tiêu đề chung phía trên các cột (tùy chọn)" value={data.title} onChange={title => set({ title })} />
    <Section title="Bố cục các cột">
      <div className="admin-form-grid">
        <label className="admin-field">Số cột<select disabled={disabled} onChange={event => setCount(Number(event.target.value))} value={data.columns.length}><option value={2}>2 cột</option><option value={3}>3 cột</option><option value={4}>4 cột</option></select></label>
        {data.columns.length === 2 ? <label className="admin-field">Tỉ lệ cột<select disabled={disabled} onChange={event => set({ layout: event.target.value as ColumnsBlock["data"]["layout"] })} value={data.layout}>{columnsRatioOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label> : null}
        <label className="admin-field">Khoảng cách giữa các cột<select disabled={disabled} onChange={event => set({ gap: event.target.value as ColumnsBlock["data"]["gap"] })} value={data.gap}><option value="sm">Gọn</option><option value="md">Vừa</option><option value="lg">Rộng</option></select></label>
        <label className="admin-field">Căn các cột theo chiều dọc<select disabled={disabled} onChange={event => set({ verticalAlign: event.target.value as ColumnsBlock["data"]["verticalAlign"] })} value={data.verticalAlign}><option value="top">Trên</option><option value="center">Giữa</option><option value="bottom">Dưới</option></select></label>
        <label className="admin-field">Trên điện thoại<select disabled={disabled} onChange={event => set({ stack: event.target.value as ColumnsBlock["data"]["stack"] })} value={data.stack}><option value="normal">Xếp dọc theo thứ tự cột</option><option value="reverse">Đưa cột cuối lên trên</option></select></label>
      </div>
    </Section>
    {data.columns.map((column, columnIndex) => <Section key={columnIndex} title={`Cột ${columnIndex + 1} (${column.items.length}/12 mục)`}>
      {column.items.map((item, itemIndex) => <ListItem field={`column:${columnIndex}:${itemIndex}`} index={itemIndex} key={itemIndex} length={column.items.length} noun={columnItemKinds.find(entry => entry.kind === item.kind)?.label ?? "Mục"} onDelete={() => setItems(columnIndex, column.items.filter((_, index) => index !== itemIndex))} onMove={delta => setItems(columnIndex, moveListItem(column.items, itemIndex, delta))}>
        <ColumnItemFields disabled={disabled} item={item} onChange={next => setItems(columnIndex, column.items.map((entry, index) => index === itemIndex ? next : entry))} onUploadingChange={onUploadingChange} />
      </ListItem>)}
      {column.items.length ? null : <p className="admin-help">Cột trống. Thêm tiêu đề, đoạn văn, ảnh, nút hoặc danh sách bên dưới.</p>}
      {column.items.length < 12 ? <div aria-label={`Thêm vào cột ${columnIndex + 1}`} className="admin-chips" role="group">{columnItemKinds.map(entry => <button className="admin-chip" disabled={disabled} key={entry.kind} onClick={() => setItems(columnIndex, [...column.items, newColumnItem(entry.kind)])} type="button">+ {entry.label}</button>)}</div> : null}
    </Section>)}
  </>;
}

const mediaTextLayoutOptions: ReadonlyArray<LayoutOption<MediaTextBlock["data"]["layout"]>> = [
  { value: "image_right", label: "Chữ trái · ảnh phải", hint: "Phần chữ nằm bên trái, ảnh nằm bên phải.", preview: heroLayoutPreviews.split },
  { value: "image_left", label: "Ảnh trái · chữ phải", hint: "Ảnh nằm bên trái, phần chữ nằm bên phải.", preview: heroLayoutPreviews.split_reverse },
];

function MediaTextFields({ block, onChange, disabled, onUploadingChange }: { block: MediaTextBlock; onChange: (block: PageBlock) => void; disabled?: boolean; onUploadingChange: (pending: boolean) => void }) {
  const data = block.data;
  const set = (patch: Partial<MediaTextBlock["data"]>) => onChange({ ...block, data: { ...data, ...patch } });
  return <>

    <IntroFields description={data.description} eyebrow={data.eyebrow} onPatch={set} title={data.title} />
    <Section field="bullets" title="Danh sách có dấu ✓ (tùy chọn)"><AdminListEditor addLabel="Thêm dòng" itemLabel="Dòng" items={data.bullets} maxItems={8} maxLength={200} onChange={bullets => set({ bullets })} placeholder="Ví dụ: Báo cáo doanh thu theo thời gian thực" /></Section>
    <div className="contents" data-field="image"><MediaPicker disabled={disabled} hint="Ảnh chụp màn hình phần mềm, ảnh sản phẩm hoặc minh họa. Nên rộng từ 1200px." label="Ảnh" onUploadingChange={onUploadingChange} preview value={data.mediaId} onChange={mediaId => set({ mediaId })} /></div>
    <ActionFields field="primaryAction" title="Nút chính" value={data.primaryAction} onChange={primaryAction => set({ primaryAction })} />
    <ActionFields field="secondaryAction" title="Nút phụ" value={data.secondaryAction} onChange={secondaryAction => set({ secondaryAction })} />
  </>;
}

type PricingBlock = Extract<PageBlock, { type: "pricing" }>;
type PricingPlan = PricingBlock["data"]["plans"][number];
// Cùng form bảng giá dùng cho trang chi tiết sản phẩm/dịch vụ (dữ liệu chung `pricingDataSchema`).
export function PricingEditor({ value, onChange }: { value: PricingBlock["data"]; onChange: (value: PricingBlock["data"]) => void }) {
  return <PricingFields block={{ type: "pricing", isEnabled: true, data: value }} onChange={(block) => { if (block.type === "pricing") onChange(block.data); }} />;
}

function PricingFields({ block, onChange }: { block: PricingBlock; onChange: (block: PageBlock) => void }) {
  const data = block.data;
  const set = (patch: Partial<PricingBlock["data"]>) => onChange({ ...block, data: { ...data, ...patch } });
  const setPlan = (index: number, patch: Partial<PricingPlan>) => set({ plans: patchAt(data.plans, index, patch) });
  return <>
    <IntroFields description={data.description} eyebrow={data.eyebrow} onPatch={set} title={data.title} />
    <NullableField field="note" label="Ghi chú dưới bảng giá (ví dụ: Giá chưa gồm VAT)" value={data.note} onChange={note => set({ note })} />
    <Section title={`Các gói (${data.plans.length}/4)`}>{data.plans.map((plan, index) => <ListItem index={index} key={index} length={data.plans.length} noun="Gói" onDelete={() => { if (data.plans.length > 1) set({ plans: data.plans.filter((_, planIndex) => planIndex !== index) }); }} onMove={direction => set({ plans: changePosition(data.plans, index, direction) })} summary={plan.name}>
      <div className="admin-form-grid"><Field field="name" label="Tên gói" value={plan.name} onChange={name => setPlan(index, { name })} /><NullableField field="badge" label="Nhãn nổi bật (ví dụ: Phổ biến)" value={plan.badge} onChange={badge => setPlan(index, { badge })} /></div>
      <div className="admin-form-grid"><Field field="price" label="Giá (ví dụ: 199.000đ hoặc Liên hệ)" value={plan.price} onChange={price => setPlan(index, { price })} /><NullableField field="period" label="Đơn vị (ví dụ: /tháng)" value={plan.period} onChange={period => setPlan(index, { period })} /></div>
      <NullableField field="description" label="Mô tả ngắn" value={plan.description} onChange={description => setPlan(index, { description })} />
      <Section title={`Tính năng của gói ${index + 1}`}><AdminListEditor addLabel="Thêm tính năng" itemLabel={`Tính năng gói ${index + 1}`} items={plan.features} maxItems={20} maxLength={200} onChange={features => setPlan(index, { features })} placeholder="Ví dụ: Không giới hạn đơn hàng" /></Section>
      <ActionFields field="action" title="Nút của gói" value={plan.action} onChange={action => setPlan(index, { action })} />
      <CardColor onChange={background => setPlan(index, { background })} value={plan.background} />
      <label className="admin-check"><input checked={plan.highlighted} onChange={event => set({ plans: data.plans.map((entry, planIndex) => ({ ...entry, highlighted: planIndex === index ? event.target.checked : false })) })} type="checkbox" />Gói nổi bật (làm to, viền màu)</label>
      
    </ListItem>)}{data.plans.length < 4 ? <button type="button" onClick={() => set({ plans: [...data.plans, { name: `Gói ${data.plans.length + 1}`, price: "Liên hệ", period: null, description: null, features: [], action: { label: "Đăng ký", href: "/lien-he" }, highlighted: false, badge: null }] })}>Thêm gói</button> : null}</Section>
  </>;
}

type GroupedListBlock = Extract<PageBlock, { type: "grouped_list" }>;
type GroupedListGroup = GroupedListBlock["data"]["groups"][number];
const maxGroupedListGroups = 6;
const maxGroupedListItems = 30;

function GroupedListFields({ block, onChange }: { block: GroupedListBlock; onChange: (block: PageBlock) => void }) {
  const data = block.data;
  const set = (patch: Partial<GroupedListBlock["data"]>) => onChange({ ...block, data: { ...data, ...patch } });
  const setGroup = (index: number, patch: Partial<GroupedListGroup>) => set({ groups: patchAt(data.groups, index, patch) });
  return <>
    <IntroFields description={data.description} eyebrow={data.eyebrow} onPatch={set} title={data.title} />
    <div className="admin-form-grid">
      <NullableField field="groupLabel" label="Nhãn nhỏ trên tên nhóm (ví dụ: Nhóm ngành)" value={data.groupLabel} onChange={groupLabel => set({ groupLabel })} />
      <label className="admin-check self-end"><input checked={data.showCount} onChange={event => set({ showCount: event.target.checked })} type="checkbox" />Hiện số mục ở góc mỗi nhóm</label>
    </div>
    <Section title={`Các nhóm (${data.groups.length}/${maxGroupedListGroups})`}>
      <p className="admin-help">Mỗi nhóm là một thẻ, biểu tượng cùng tông xanh thương hiệu; tiêu đề phần căn trái. 2 nhóm trải hết bề ngang, từ 3 nhóm xếp 3 cột. Mục có đường dẫn thì bấm được (ví dụ /thiet-bi/may-pos-iorder-iod86).</p>
      {data.groups.map((group, index) => <ListItem index={index} key={index} length={data.groups.length} noun="Nhóm" onDelete={() => { if (data.groups.length > 1) set({ groups: data.groups.filter((_, groupIndex) => groupIndex !== index) }); }} onMove={direction => set({ groups: changePosition(data.groups, index, direction) })} summary={group.title}>
        <div className="flex items-end gap-2"><div className="admin-field shrink-0">Biểu tượng<IconPicker label={`Biểu tượng nhóm ${index + 1}`} onChange={icon => setGroup(index, { icon })} value={group.icon} /></div><div className="min-w-0 flex-1"><Field label={`Tên nhóm ${index + 1}`} value={group.title} onChange={title => setGroup(index, { title })} /></div></div>
        {group.title.trim() ? null : <p className="admin-help admin-text-warning">Nhóm cần có tên để lưu được.</p>}
        <div className="admin-field"><span>Các mục ({group.items.length}/{maxGroupedListItems})</span>
          {group.items.map((item, itemIndex) => {
            const setItems = (items: GroupedListGroup["items"]) => setGroup(index, { items });
            const label = `mục ${itemIndex + 1} của nhóm ${index + 1}`;
            return <div className="admin-grouped-row" key={itemIndex} data-builder-item={itemIndex}>
              <IconPicker label={`Biểu tượng ${label}`} onChange={icon => setItems(patchAt(group.items, itemIndex, { icon }))} value={item.icon} />
              <input aria-label={`Tên ${label}`} className="admin-input" maxLength={120} onChange={event => setItems(patchAt(group.items, itemIndex, { label: event.target.value }))} placeholder="Ví dụ: Thời trang" value={item.label} />
              <input aria-label={`Đường dẫn ${label}`} className="admin-input admin-grouped-row__href" maxLength={1000} onChange={event => setItems(patchAt(group.items, itemIndex, { href: event.target.value || null }))} placeholder="Đường dẫn (tùy chọn)" value={item.href ?? ""} />
              <AdminListRowControls index={itemIndex} label={label} length={group.items.length} onMove={direction => setItems(moveListItem(group.items, itemIndex, direction))} onRemove={() => setItems(group.items.filter((_, entryIndex) => entryIndex !== itemIndex))} />
            </div>;
          })}
          {group.items.some(item => !item.label.trim()) ? <p className="admin-help admin-text-warning">Mục để trống tên sẽ bị bỏ khi lưu.</p> : null}
          {group.items.length < maxGroupedListItems ? <button className="justify-self-start" type="button" onClick={() => setGroup(index, { items: [...group.items, { label: "", icon: group.items.at(-1)?.icon ?? null, href: null }] })}>Thêm mục</button> : null}
        </div>
        <ActionFields field="action" title="Nút cuối thẻ" value={group.action} onChange={action => setGroup(index, { action })} />
        <CardColor onChange={background => setGroup(index, { background })} value={group.background} />
        
      </ListItem>)}
      {data.groups.length < maxGroupedListGroups ? <button type="button" onClick={() => set({ groups: [...data.groups, { title: `Nhóm ${data.groups.length + 1}`, icon: null, items: [], action: data.groups.at(-1)?.action ?? null }] })}>Thêm nhóm</button> : null}
    </Section>
  </>;
}

// Mục chưa có tên giữ trong form để nhập tiếp, nhưng bỏ khi lưu (schema bắt buộc tên).
export function withoutEmptyGroupedListItems(blocks: PageBlock[]): PageBlock[] {
  return blocks.map(block => block.type === "grouped_list" ? { ...block, data: { ...block.data, groups: block.data.groups.map(group => ({ ...group, items: group.items.filter(item => item.label.trim()) })) } } : block);
}

type VideoBlock = Extract<PageBlock, { type: "video" }>;

// Khối video: dán link YouTube, xem trước ngay trong CMS bằng khung phát thật.
function VideoFields({ block, onChange }: { block: VideoBlock; onChange: (block: PageBlock) => void }) {
  const set = (patch: Partial<VideoBlock["data"]>) => onChange({ ...block, data: { ...block.data, ...patch } });
  const videoId = youtubeVideoId(block.data.url);
  return <>
    <label className="admin-field" data-field="url">Link video YouTube<input inputMode="url" onChange={event => set({ url: event.target.value })} placeholder="https://www.youtube.com/watch?v=… hoặc https://youtu.be/…" value={block.data.url} /></label>
    {block.data.url.trim() && !videoId ? <p className="admin-help admin-text-warning">Link chưa đúng dạng YouTube. Mở video trên YouTube, bấm Chia sẻ rồi sao chép link.</p> : null}
    {videoId ? <div className="admin-video-preview"><iframe allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={youtubeEmbedUrl(videoId)} title="Xem trước video" /></div> : <p className="admin-help">Dán link để xem trước video ngay tại đây. Nhận link xem (watch), link rút gọn youtu.be, Shorts và video trực tiếp.</p>}
    <NullableField field="eyebrow" label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => set({ eyebrow })} />
    <NullableField field="title" label="Tiêu đề (tùy chọn)" value={block.data.title} onChange={title => set({ title })} />
    <NullableField field="description" label="Mô tả" multiline value={block.data.description} onChange={description => set({ description })} />
    <NullableField field="caption" label="Chú thích dưới video" value={block.data.caption} onChange={caption => set({ caption })} />
    <p className="admin-help">Video nhúng ở chế độ bảo mật nâng cao của YouTube (không đặt cookie cho tới khi người xem bấm phát). Thu nhỏ video bằng “Độ rộng nội dung” trong mục Giao diện khối.</p>
  </>;
}

function BlockFields({ block, onChange, disabled, onUploadingChange }: { block: PageBlock; onChange: (block: PageBlock) => void; disabled?: boolean; onUploadingChange: (pending: boolean) => void }) {
  switch (block.type) {
    case "hero": return <HeroFields block={block} disabled={disabled} onChange={onChange} onUploadingChange={onUploadingChange} part="content" />;
    case "media_text": return <MediaTextFields block={block} disabled={disabled} onChange={onChange} onUploadingChange={onUploadingChange} />;
    case "pricing": return <PricingFields block={block} onChange={onChange} />;
    case "grouped_list": return <GroupedListFields block={block} onChange={onChange} />;
    case "columns": return <ColumnsFields block={block} disabled={disabled} onChange={onChange} onUploadingChange={onUploadingChange} />;
    case "stats": return <><NullableField field="eyebrow" label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} /><NullableField field="title" label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><Section title="Các số liệu">{block.data.items.map((item, index) => <ListItem index={index} key={index} length={block.data.items.length} noun="Số liệu" onDelete={() => onChange({ ...block, data: { ...block.data, items: block.data.items.filter((_, itemIndex) => itemIndex !== index) } })} onMove={direction => onChange({ ...block, data: { ...block.data, items: changePosition(block.data.items, index, direction) } })} summary={`${item.value} ${item.label}`}><div className="admin-form-grid"><Field field="value" label="Giá trị" value={item.value} onChange={value => onChange({ ...block, data: { ...block.data, items: patchAt(block.data.items, index, { value }) } })} /><Field field="label" label="Nhãn" value={item.label} onChange={label => onChange({ ...block, data: { ...block.data, items: patchAt(block.data.items, index, { label }) } })} /></div><NullableField field="note" label="Ghi chú" value={item.note} onChange={note => onChange({ ...block, data: { ...block.data, items: patchAt(block.data.items, index, { note }) } })} /></ListItem>)}<button type="button" onClick={() => onChange({ ...block, data: { ...block.data, items: [...block.data.items, { value: "0", label: "Nhãn số liệu", note: null }] } })}>Thêm số liệu</button></Section></>;
    case "features":
    case "industries":
    case "ecosystem":
    case "process": return <><IntroFields description={block.data.description} eyebrow={block.data.eyebrow} onPatch={patch => onChange({ ...block, data: { ...block.data, ...patch } })} title={block.data.title} />{block.type === "industries" || block.type === "ecosystem" ? <div className="flex flex-wrap items-center gap-3"><p className="admin-help m-0">Thành phần cũ, hiển thị giống “Lưới thẻ”.</p><button type="button" onClick={() => onChange({ ...block, type: "features" })}>Chuyển thành Lưới thẻ</button></div> : null}<CardItemsEditor bento={block.type !== "process" && block.data.cardStyle === "bento"} items={block.data.items} onChange={items => onChange({ ...block, data: { ...block.data, items } })} showIcons={block.type !== "process"} disabled={disabled} onUploadingChange={onUploadingChange} /></>;
    case "testimonials": return <><IntroFields eyebrow={block.data.eyebrow} onPatch={patch => onChange({ ...block, data: { ...block.data, ...patch } })} title={block.data.title} /><NumberField field="limit" label="Số lượng hiển thị" value={block.data.limit} max={30} onChange={limit => onChange({ ...block, data: { ...block.data, limit } })} /></>;
    case "partners": return <><IntroFields description={block.data.description ?? null} eyebrow={block.data.eyebrow} onPatch={patch => onChange({ ...block, data: { ...block.data, ...patch } })} title={block.data.title} /><p className="admin-help">Logo, tên và liên kết lấy từ mục Đối tác &amp; Đánh giá. Chỉ các mục đang hiển thị mới xuất hiện trên trang chủ.</p><label className="admin-field" data-field="kind">Nhóm hiển thị<select value={block.data.kind} onChange={event => onChange({ ...block, data: { ...block.data, kind: event.target.value as typeof block.data.kind } })}><option value="all">Tất cả</option><option value="partner">Đối tác</option><option value="customer">Khách hàng</option></select></label><NumberField field="limit" label="Số lượng hiển thị" value={block.data.limit} max={60} onChange={limit => onChange({ ...block, data: { ...block.data, limit } })} /></>;
    case "featured_posts": return <><IntroFields eyebrow={block.data.eyebrow} onPatch={patch => onChange({ ...block, data: { ...block.data, ...patch } })} title={block.data.title} /><NumberField field="limit" label="Số bài viết hiển thị" value={block.data.limit} max={12} onChange={limit => onChange({ ...block, data: { ...block.data, limit } })} /></>;
    case "faq": return <><IntroFields eyebrow={block.data.eyebrow} onPatch={patch => onChange({ ...block, data: { ...block.data, ...patch } })} title={block.data.title} /><Section title="Câu hỏi và trả lời">{block.data.items.map((item, index) => <ListItem index={index} key={index} length={block.data.items.length} noun="Câu hỏi" onDelete={() => onChange({ ...block, data: { ...block.data, items: block.data.items.filter((_, itemIndex) => itemIndex !== index) } })} onMove={direction => onChange({ ...block, data: { ...block.data, items: changePosition(block.data.items, index, direction) } })} summary={item.question}><Field field="question" label="Câu hỏi" value={item.question} onChange={question => onChange({ ...block, data: { ...block.data, items: patchAt(block.data.items, index, { question }) } })} /><Field field="answer" label="Trả lời" multiline value={item.answer} onChange={answer => onChange({ ...block, data: { ...block.data, items: patchAt(block.data.items, index, { answer }) } })} /></ListItem>)}<button type="button" onClick={() => onChange({ ...block, data: { ...block.data, items: [...block.data.items, { question: "Câu hỏi mới", answer: "Nội dung trả lời" }] } })}>Thêm câu hỏi</button></Section></>;
    case "cta": return <><IntroFields eyebrow={block.data.eyebrow} onPatch={patch => onChange({ ...block, data: { ...block.data, ...patch } })} title={block.data.title} /><ActionFields title="Nút hành động" value={block.data.action} optional={false} onChange={action => action && onChange({ ...block, data: { ...block.data, action } })} /></>;
    case "lead_form": return <><Field label="Tiêu đề" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} /><NullableField label="Mô tả" multiline value={block.data.description} onChange={description => onChange({ ...block, data: { ...block.data, description } })} /><Field label="Nhãn nút gửi" value={block.data.submitLabel} onChange={submitLabel => onChange({ ...block, data: { ...block.data, submitLabel } })} /><Section title="Thẻ Đăng ký dùng thử cạnh biểu mẫu"><p className="admin-help">Nút dẫn tới địa chỉ dùng thử trong Cài đặt › Liên kết ngoài; chưa nhập địa chỉ thì thẻ không hiện. Để trống ô thì dùng chữ mặc định.</p><div className="admin-form-grid"><NullableField label="Câu mời (mặc định: Muốn tự trải nghiệm trước?)" value={block.data.trialTitle ?? null} onChange={trialTitle => onChange({ ...block, data: { ...block.data, trialTitle } })} /><NullableField label="Nhãn nút (mặc định: Đăng ký dùng thử)" value={block.data.trialLabel ?? null} onChange={trialLabel => onChange({ ...block, data: { ...block.data, trialLabel } })} /></div></Section><Section title="Nhu cầu để khách hàng chọn"><p className="admin-help">Hiện thành danh sách chọn “Nhu cầu chính”; để trống thì là ô nhập tự do.</p><AdminListEditor addLabel="Thêm nhu cầu" itemLabel="Nhu cầu" items={block.data.needOptions} maxItems={20} maxLength={200} onChange={needOptions => onChange({ ...block, data: { ...block.data, needOptions } })} placeholder="Ví dụ: Phần mềm quản lý bán hàng" /></Section><p className="admin-help">Biểu mẫu chỉ bắt buộc họ tên và số điện thoại (kèm email, nhu cầu, mô tả). Hotline, email và giờ làm việc bên cạnh lấy từ Cài đặt › Thông tin website.</p></>;
    case "rich_text": return <><NullableField field="title" label="Tiêu đề (tùy chọn)" value={block.data.heading} onChange={heading => onChange({ ...block, data: { ...block.data, heading } })} /><div className="admin-field" data-field="body">Nội dung<RichTextEditor disabled={disabled} onChange={body => onChange({ ...block, data: { ...block.data, body } })} showTemplates={false} value={typeof block.data.body === "string" ? plainTextToRichDocument(block.data.body) : block.data.body} /></div></>;
    case "image": return <><MediaPicker disabled={disabled} label="Ảnh" onUploadingChange={onUploadingChange} value={block.data.mediaId || null} onChange={mediaId => onChange({ ...block, data: { ...block.data, mediaId: mediaId ?? "" } })} /><NullableField field="alt" label="Mô tả thay thế" value={block.data.alt} onChange={alt => onChange({ ...block, data: { ...block.data, alt } })} /><NullableField field="caption" label="Chú thích" multiline value={block.data.caption} onChange={caption => onChange({ ...block, data: { ...block.data, caption } })} /></>;
    case "collection_list": return <>
      <label className="admin-field" data-field="source">Nguồn nội dung<select value={block.data.source} onChange={event => onChange({ ...block, data: { ...block.data, source: event.target.value as CollectionSource } })}>{collectionSources.map(source => <option key={source.value} value={source.value}>{source.label}</option>)}</select></label>
      <NullableField field="eyebrow" label="Dòng giới thiệu" value={block.data.eyebrow} onChange={eyebrow => onChange({ ...block, data: { ...block.data, eyebrow } })} />
      <NullableField field="title" label="Tiêu đề (để trống khi danh sách nằm ngay dưới phần đầu trang)" value={block.data.title} onChange={title => onChange({ ...block, data: { ...block.data, title } })} />
      <NullableField field="description" label="Mô tả" multiline value={block.data.description} onChange={description => onChange({ ...block, data: { ...block.data, description } })} />
      <Field field="limit" label="Số mục tối đa (để trống: hiển thị tất cả)" min={1} type="number" value={block.data.limit === null ? "" : String(block.data.limit)} onChange={next => onChange({ ...block, data: { ...block.data, limit: next === "" ? null : Math.max(1, Math.min(100, Number(next) || 1)) } })} />
      <p className="admin-help">{block.data.limit ? "Có giới hạn số mục: tiêu đề căn trái, bên phải có nút “Xem tất cả →” sang trang tổng hợp của nguồn này." : "Hiển thị tất cả: tiêu đề căn giữa, không có nút “Xem tất cả” (dùng cho trang danh sách)."}</p>
    </>;
    case "video": return <VideoFields block={block} onChange={onChange} />;
    case "download_list": return <><IntroFields eyebrow={block.data.eyebrow} onPatch={patch => onChange({ ...block, data: { ...block.data, ...patch } })} title={block.data.title} /></>;
  }
}

export type PageBlocksEditorProps = {
  blocks: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
  onUploadingChange?: (pending: boolean) => void;
  /** Trang danh sách: phần đầu trang cố định ở vị trí đầu, chỉ thêm được khối phục vụ danh sách. */
  listing?: boolean;
  /** Trang tự tạo: hiện các nhóm thành phần ngay trong form để bắt đầu bố cục nhanh hơn. */
  showGroupPicker?: boolean;
  /** Giới hạn loại thành phần theo nơi dùng, ví dụ trang chi tiết không thêm phần đầu trang thứ hai. */
  allowedTypes?: readonly BlockType[];
  layout?: "accordion" | "split" | "builder";
  preview?: ReactNode;
  /** Trình dựng ba vùng: chỉ hiện canvas (ẩn danh sách lớp và bảng thuộc tính). */
  canvasWide?: boolean;
  /**
   * Các phần nằm ngoài danh sách khối (ví dụ trang sản phẩm: phần đầu trang; trang thiết bị: phần đầu trang và thông số) nhưng vẫn là
   * những mục đầu tiên của trình dựng: cố định đầu danh sách, mục thứ i được chọn bằng chỉ số -(i + 1) (cả trên canvas), bảng thuộc tính hiện `detail`.
   */
  leads?: ReadonlyArray<FixedSection>;
  /** Như `leads` nhưng cố định cuối danh sách (ví dụ "Nội dung liên quan"); mục thứ i có chỉ số -(11 + i). */
  tails?: ReadonlyArray<FixedSection>;
  /** Lần bấm trên canvas theo mã: chọn đúng mục con (item) và đưa con trỏ vào đúng trường (field) trong bảng thuộc tính. */
  selectionRequest?: { index: number; item?: string; field?: string; seq: number } | null;
  /** Thành phần đang mở do màn cha giữ (để thẻ "Bố cục trang" mở/nhảy tới); bỏ trống thì tự giữ. */
  openIndex?: number | null;
  onOpenIndexChange?: (index: number | null) => void;
};

type BlockTab = "content" | "media" | "appearance" | "itemLayout";
/**
 * Thân thành phần đang mở, chia tab cho form ngắn lại: Nội dung | (phần đầu trang) Bố cục & ảnh | Giao diện.
 * Tab chưa mở không nằm trong form (không bị chặn lưu bởi ô ẩn). Đang tải ảnh thì khóa đổi tab để không mất upload dở.
 */
function BlockLayoutFields({ block, disabled, onChange, onUploadingChange }: { block: PageBlock; disabled?: boolean; onChange: (block: PageBlock) => void; onUploadingChange: (pending: boolean) => void }) {
  const id = useId();
  if (block.type === "hero") return <><HeroFields block={block} disabled={disabled} onChange={onChange} onUploadingChange={onUploadingChange} part="media" />{block.data.layout !== "slider" ? <HeroToneField block={block} disabled={disabled} onChange={onChange} /> : null}</>;
  if (block.type === "media_text") return <LayoutPicker label="Kiểu bố cục" name={id} options={mediaTextLayoutOptions} value={block.data.layout} onChange={layout => onChange({ ...block, data: { ...block.data, layout } })} />;
  if (block.type === "features" || block.type === "industries" || block.type === "ecosystem") return <CardStyleField block={block} onChange={onChange} />;
  return null;
}

const componentSettingsSelection: BuilderItemSelection = { path: "component.settings", index: 0, heading: "", tab: "content" };
const heroLayoutSelection: BuilderItemSelection = { path: "hero.layout", index: 0, heading: "", tab: "media" };
// Mục con có bố cục riêng: thẻ của lưới thẻ, số liệu nổi bật, câu hỏi, gói giá và nhóm của danh sách theo nhóm.
// Các mục khác (dòng trong nhóm, mục trượt…) dùng căn chữ mặc định của khối.
function itemAlignSupported(block: PageBlock, path: string) {
  switch (block.type) {
    case "features": case "industries": case "ecosystem": case "process": case "stats": case "faq": return path === "items";
    case "pricing": return path === "plans";
    case "grouped_list": return path === "groups";
    default: return false;
  }
}
// Thẻ của lưới thẻ còn chọn được vị trí biểu tượng (trên hoặc bên trái chữ).
function itemIconPositionSupported(block: PageBlock, path: string) {
  return path === "items" && (block.type === "features" || block.type === "industries" || block.type === "ecosystem" || block.type === "process");
}

const iconPositionChoices = [{ value: "top", label: "Biểu tượng phía trên chữ", Icon: PanelTop }, { value: "left", label: "Biểu tượng bên trái chữ", Icon: PanelLeft }] as const;
const itemAlignChoices = [{ value: "left", label: "Căn trái", Icon: AlignLeft }, { value: "center", label: "Căn giữa", Icon: AlignCenter }, { value: "right", label: "Căn phải", Icon: AlignRight }] as const;

/** Tab "Bố cục mục" của một mục con: chọn căn trái, giữa hoặc phải cho chữ (và biểu tượng) của riêng mục đó. */
function ItemLayoutFields({ block, selection, onChange, disabled }: { block: PageBlock; selection: BuilderItemSelection; onChange: (block: PageBlock) => void; disabled?: boolean }) {
  const collection = builderItemCollections(block).find(entry => entry.path === selection.path);
  const item = collection?.items[selection.index];
  if (!collection || !item) return <p className="admin-help">Không tìm thấy mục để chỉnh bố cục.</p>;
  const current = (item.align as ItemAlign | undefined) ?? "left";
  const patch = (change: Record<string, unknown>) => onChange(replaceBuilderItems(block, collection.path, collection.items.map((entry, index) => index === selection.index ? { ...entry, ...change } : entry)));
  const set = (align: ItemAlign) => patch({ align });
  const iconPosition = (item.iconPosition as "top" | "left" | undefined) ?? "top";
  return <>
    {itemIconPositionSupported(block, collection.path) ? <div className="admin-field">
      <span>Vị trí biểu tượng</span>
      <div aria-label="Vị trí biểu tượng" className="admin-canvas-segment" role="radiogroup">
        {iconPositionChoices.map(({ value, label, Icon }) => <button aria-checked={iconPosition === value} aria-label={label} className="admin-canvas-tool" disabled={disabled} key={value} onClick={() => patch({ iconPosition: value === "top" ? undefined : value })} role="radio" title={label} type="button"><Icon aria-hidden="true" size={16} /></button>)}
      </div>
      <small className="admin-help">Áp dụng cho kiểu thẻ gọn; thẻ ảnh và thẻ lớn giữ vị trí cố định.</small>
    </div> : null}
    <div className="admin-field">
    <span>Căn chữ trong mục này</span>
    <div aria-label="Căn chữ trong mục này" className="admin-canvas-segment" role="radiogroup">
      {itemAlignChoices.map(({ value, label, Icon }) => <button aria-checked={current === value} aria-label={label} className="admin-canvas-tool" disabled={disabled} key={value} onClick={() => set(value)} role="radio" title={label} type="button"><Icon aria-hidden="true" size={16} /></button>)}
    </div>
    <small className="admin-help">Chỉ áp dụng cho mục đang chọn. Nền, độ rộng, khoảng cách và chiều cao của cả khối chỉnh ở tab “Bố cục khối” của thành phần cha.</small>
    </div>
  </>;
}

function BlockBody({ block, disabled, onChange, onUploadingChange, itemSelection }: { itemSelection?: BuilderItemSelection | null; block: PageBlock; disabled?: boolean; onChange: (block: PageBlock) => void; onUploadingChange: (key: string, pending: boolean) => void }) {
  const [activeTab, setTab] = useState<BlockTab>("content");
  const commonLayout = itemSelection?.path === "hero.layout";
  const commonSettings = itemSelection?.path === "component.settings";
  // Mục con (thẻ, số liệu…) có tab "Bố cục" riêng với căn chữ của chính mục đó; "Bố cục khối" chỉ dành cho thành phần cha.
  const editingItem = Boolean(itemSelection) && !commonLayout && !commonSettings;
  const alignable = editingItem && itemAlignSupported(block, itemSelection!.path);
  const itemKey = itemSelection ? `${itemSelection.path}:${itemSelection.parentIndex ?? ""}:${itemSelection.index}` : "";
  const [itemTabState, setItemTabState] = useState<{ key: string; tab: "content" | "itemLayout" }>({ key: "", tab: "content" });
  const itemTab = itemTabState.key === itemKey ? itemTabState.tab : "content";
  const tab: BlockTab = commonLayout ? "media" : commonSettings ? activeTab : alignable && itemTab === "itemLayout" ? "itemLayout" : itemSelection?.tab ?? activeTab;
  const bodyRef = useRef<HTMLDivElement>(null);
  const collectionHeadings = JSON.stringify(builderItemCollections(block).map(collection => collection.heading));
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const reset = () => { body.classList.remove("admin-builder-editing-item"); body.querySelectorAll<HTMLElement>("[data-builder-filtered]").forEach(element => { element.hidden = false; element.removeAttribute("data-builder-filtered"); }); body.querySelectorAll<HTMLElement>("[data-builder-active-collection], [data-builder-item]").forEach(element => { element.removeAttribute("data-builder-active-collection"); element.hidden = false; }); };
    reset();
    if (commonSettings && tab === "content") {
      const headings = JSON.parse(collectionHeadings) as string[];
      body.querySelectorAll<HTMLElement>("[data-builder-collection]").forEach(element => {
        if (headings.some(heading => element.dataset.builderCollection?.startsWith(heading))) { element.hidden = true; element.dataset.builderFiltered = "true"; }
      });
      return reset;
    }
    if (!itemSelection || commonSettings || itemSelection.path === "hero.layout") return;
    const animation = requestAnimationFrame(() => {
      const collection = Array.from(body.querySelectorAll<HTMLElement>("[data-builder-collection]")).find(element => element.dataset.builderCollection?.startsWith(itemSelection.heading));
      if (!collection) return;
      const group = itemSelection.parentIndex === undefined ? collection : collection.querySelector<HTMLElement>(`:scope > [data-builder-item="${itemSelection.parentIndex}"]`);
      const target = itemSelection.path === "hero.primary" ? collection : group?.querySelector<HTMLElement>(`:scope > [data-builder-item="${itemSelection.index}"]`) ?? group?.querySelector<HTMLElement>(`[data-builder-item="${itemSelection.index}"]`);
      if (!target) return;
      const panel = body.querySelector(".admin-block-tabs__panel");
      let top: HTMLElement = target;
      while (top.parentElement && top.parentElement !== panel) top = top.parentElement;
      top.setAttribute("data-builder-active-collection", "true");
      body.classList.add("admin-builder-editing-item");
      body.querySelectorAll<HTMLElement>("[data-builder-item]").forEach(element => { element.hidden = element !== target && !element.contains(target) && !target.contains(element); });
      let branch: HTMLElement = target;
      while (branch.parentElement && branch.parentElement !== panel) {
        for (const sibling of Array.from(branch.parentElement.children)) {
          if (sibling instanceof HTMLElement && sibling !== branch && sibling.tagName !== "LEGEND" && !sibling.classList.contains("admin-list-item__head")) { sibling.hidden = true; sibling.dataset.builderFiltered = "true"; }
        }
        branch = branch.parentElement;
      }
      if (itemSelection.focus !== false) target.querySelector<HTMLElement>("input:not(:disabled),textarea:not(:disabled),select:not(:disabled)")?.focus();
    });
    return () => { cancelAnimationFrame(animation); reset(); };
  }, [itemSelection, tab, commonSettings, collectionHeadings]);
  const [uploading, setUploading] = useState(0);
  const id = useId();
  const hero = block.type === "hero" ? block : null;
  const tabs: Array<[BlockTab, string]> = commonLayout ? [["media", "Bố cục khối"]] : itemSelection && !commonSettings ? (alignable ? [["content", "Nội dung"], ["itemLayout", "Bố cục mục"]] : [["content", "Nội dung"]]) : hero ? [["content", "Nội dung"], ["media", "Bố cục khối"]] : [["content", commonSettings ? "Thông tin chung" : "Nội dung"], ["appearance", "Bố cục khối"]];
  const track = (key: string) => (pending: boolean) => { setUploading((count) => Math.max(0, count + (pending ? 1 : -1))); onUploadingChange(key, pending); };
  return <div className="admin-block__body" ref={bodyRef}>
    <div aria-label="Nhóm thiết lập của thành phần" className="admin-block-tabs" role="tablist">{tabs.map(([key, label]) => <button aria-controls={`${id}-panel`} aria-selected={tab === key} className="admin-block-tabs__tab" disabled={Boolean(uploading || (editingItem && !alignable)) && tab !== key} id={`${id}-${key}`} key={key} onClick={() => { if (editingItem) setItemTabState({ key: itemKey, tab: key === "itemLayout" ? "itemLayout" : "content" }); else setTab(key); }} role="tab" title={uploading && tab !== key ? "Đang tải ảnh, đợi xong rồi chuyển tab" : undefined} type="button">{label}</button>)}</div>
    <fieldset disabled={disabled} aria-labelledby={`${id}-${tab}`} className="admin-block-tabs__panel" id={`${id}-panel`} role="tabpanel">
      {tab === "content" ? <BlockFields block={block} disabled={disabled} onUploadingChange={track("content")} onChange={onChange} /> : null}
      {tab === "itemLayout" && itemSelection ? <ItemLayoutFields block={block} disabled={disabled} onChange={onChange} selection={itemSelection} /> : null}
      {tab === "media" || tab === "appearance" ? <>
        <BlockLayoutFields block={block} disabled={disabled} onChange={onChange} onUploadingChange={track("appearance")} />
        <BlockAppearanceFields block={block} disabled={disabled} onChange={onChange} onUploadingChange={track("appearance")} />
      </> : null}
    </fieldset>
  </div>;
}

/** Điều khiển đầu tiên của trường có mã `field` (thuộc tính data-field trên form) đang hiện trong bảng thuộc tính. */
function findFieldById(panel: HTMLElement, field: string): HTMLElement | null {
  const selector = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), textarea, [contenteditable="true"], button';
  // Nhiều trường cùng mã có thể có mặt (một ở khối, một ở mục con); lấy ô đầu tiên đang hiện (không bị ẩn khi đang sửa một mục con).
  for (const wrapper of Array.from(panel.querySelectorAll<HTMLElement>("[data-field]"))) {
    if (wrapper.dataset.field !== field) continue;
    const control = wrapper.querySelector<HTMLElement>(selector);
    if (control && control.offsetParent !== null) return control;
  }
  return null;
}

/** Mục cố định ngoài danh sách khối: `detail` là tab "Thông tin chung"; có `layoutDetail` thì thêm tab "Bố cục khối" như các thành phần khác. */
export type FixedSection = { label: string; detail: ReactNode; layoutDetail?: ReactNode };

function FixedSectionBody({ section }: { section: FixedSection }) {
  const [tab, setTab] = useState<"info" | "layout">("info");
  const id = useId();
  if (!section.layoutDetail) return <div className="admin-blocks__lead">{section.detail}</div>;
  const tabs: ReadonlyArray<readonly ["info" | "layout", string]> = [["info", "Thông tin chung"], ["layout", "Bố cục khối"]];
  return <div className="admin-block__body">
    <div aria-label="Nhóm thiết lập của thành phần" className="admin-block-tabs" role="tablist">{tabs.map(([key, label]) => <button aria-controls={`${id}-panel`} aria-selected={tab === key} className="admin-block-tabs__tab" id={`${id}-${key}`} key={key} onClick={() => setTab(key)} role="tab" type="button">{label}</button>)}</div>
    <div aria-labelledby={`${id}-${tab}`} className="admin-blocks__lead" id={`${id}-panel`} role="tabpanel">{tab === "info" ? section.detail : section.layoutDetail}</div>
  </div>;
}

export function PageBlocksEditor({ blocks, onChange, disabled, onUploadingChange, listing = false, showGroupPicker = false, readOnly = false, allowedTypes, layout = "accordion", preview, canvasWide = false, leads, tails, selectionRequest, openIndex: openIndexProp, onOpenIndexChange }: PageBlocksEditorProps) {
  const locked = disabled || readOnly;
  const uploads = useRef(new Set<string>());
  const blockList = useRef<HTMLOListElement>(null);
  const [itemSelection, setItemSelection] = useState<{ section: number; item: BuilderItemSelection } | null>(null);
  const { confirm } = useAdminConfirm();
  const [internalOpen, setInternalOpen] = useState<number | null>(blocks.length ? 0 : null);
  const controlled = openIndexProp !== undefined;
  const requestedIndex = controlled ? openIndexProp : internalOpen;
  const openIndex = layout !== "accordion" && blocks.length ? Math.min(requestedIndex ?? 0, blocks.length - 1) : requestedIndex;
  // Trình dựng ba vùng: chọn phần mới (từ danh sách hoặc bấm trên canvas) thì bảng thuộc tính về đầu và danh sách lớp cuộn tới phần đó.
  const detailPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (layout !== "builder") return;
    detailPanel.current?.scrollTo({ top: 0 });
    if (openIndex !== null) document.getElementById(`page-block-${openIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [layout, openIndex, itemSelection]);
  // Bấm trên canvas: chọn mục con theo mã do website gắn (điều chỉnh state ngay khi nhận lần bấm mới), rồi đưa con trỏ vào
  // đúng trường theo mã sau khi bảng thuộc tính vẽ xong. Không đoán theo chữ hiển thị.
  const [handledRequest, setHandledRequest] = useState(0);
  if (layout === "builder" && selectionRequest && selectionRequest.seq !== handledRequest) {
    setHandledRequest(selectionRequest.seq);
    const block = selectionRequest.index >= 0 ? blocks[selectionRequest.index] : undefined;
    const found = block ? selectionFromItemId(block, selectionRequest.item, selectionRequest.field) : null;
    // Có trường cần focus thì để hàm tìm trường làm; chỉ có mục thì để bảng tự đưa con trỏ vào ô đầu của mục.
    setItemSelection(found ? { section: selectionRequest.index, item: { ...found, focus: !selectionRequest.field } } : null);
  }
  useEffect(() => {
    if (layout !== "builder" || !selectionRequest) return;
    const { item, field } = selectionRequest;
    if (!item && !field) return;
    const timers: number[] = [];
    const attempt = () => {
      const panel = detailPanel.current;
      if (!panel) return false;
      const firstTab = panel.querySelector<HTMLButtonElement>('[role="tab"]');
      if (firstTab && firstTab.getAttribute("aria-selected") === "false" && !firstTab.disabled) firstTab.click();
      if (!field) return true;
      const control = findFieldById(panel, field);
      if (!control) return false;
      control.focus({ preventScroll: true });
      control.scrollIntoView({ block: "center", behavior: "smooth" });
      control.classList.add("admin-field-flash");
      timers.push(window.setTimeout(() => control.classList.remove("admin-field-flash"), 1400));
      return true;
    };
    timers.push(window.setTimeout(() => { if (!attempt()) timers.push(window.setTimeout(attempt, 350)); }, 180));
    return () => timers.forEach(timer => window.clearTimeout(timer));
    // Chỉ chạy khi có lần bấm mới (seq); không chạy lại mỗi lần gõ làm đổi nội dung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionRequest?.seq]);
  // Mục cố định (đầu hoặc cuối danh sách) theo chỉ số âm: -1…-9 là phần đầu, -11… là phần cuối.
  const fixedAt = (index: number | null) => index === null || index >= 0 ? undefined : index <= -11 ? tails?.[-index - 11] : leads?.[-index - 1];
  const setOpenIndex = (next: number | null | ((current: number | null) => number | null)) => {
    setItemSelection(null);
    const value = typeof next === "function" ? next(openIndex) : next;
    if (controlled) onOpenIndexChange?.(value); else setInternalOpen(value);
  };
  const pinnedHero = listing && blocks[0]?.type === "hero";
  const hasHero = blocks.some((block) => block.type === "hero");
  const canAddType = (type: BlockType) => (!allowedTypes || allowedTypes.includes(type)) && (!listing || type === "hero" || listingBlockTypes.has(type));
  const presets = pageBlockPresets.filter((preset) => preset.types.some(canAddType));
  const libraryItems = libraryBlockOptions.filter((option) => canAddType(option.type)).map((option) => ({ value: option.id, label: option.label, description: option.description, group: option.group, thumbnail: option.id, disabledReason: option.type === "hero" && hasHero ? "Trang đã có phần đầu trang." : undefined }));

  function reportUploading(key: string, pending: boolean) {
    if (pending) uploads.current.add(key);
    else uploads.current.delete(key);
    onUploadingChange?.(uploads.current.size > 0);
  }
  function update(index: number, block: PageBlock) {
    // Form khóa trong lúc tải ảnh; vẫn nhận kết quả tải của đúng thành phần đang chờ.
    const attachingUpload = Array.from(uploads.current).some(key => key.startsWith(`${index}:`));
    if (readOnly || (disabled && !attachingUpload)) return;
    onChange(blocks.map((item, itemIndex) => itemIndex === index ? block : item));
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (locked || uploads.current.size || target < 0 || target >= blocks.length || (pinnedHero && (index === 0 || target === 0))) return;
    onChange(changePosition(blocks, index, direction));
    setOpenIndex((current) => current === index ? target : current === target ? index : current);
    requestAnimationFrame(() => blockList.current?.children[target + (leads?.length ?? 0)]?.querySelector<HTMLElement>("[data-drag-handle]")?.focus());
  }
  // Kéo thả: khối mở đang chỉnh vẫn mở sau khi đổi chỗ; khối mở đầu cố định không kéo và không thả lên trước nó.
  const drag = useDragReorder({
    touch: true,
    canDrag: (index) => !locked && !(pinnedHero && index === 0),
    canDropOn: (_from, target, position) => !(pinnedHero && target === 0 && position === "before"),
    onDrop: (from, target, position) => {
      if (uploads.current.size) return;
      const openBlock = openIndex === null ? null : blocks[openIndex];
      const next = reorder(blocks, from, target, pinnedHero && target === 0 ? "after" : position);
      onChange(next);
      setOpenIndex(fixedAt(openIndex) ? openIndex : openBlock ? next.indexOf(openBlock) : null);
    },
  });
  async function remove(index: number) {
    if (uploads.current.size) return;
    if (!await confirm({ title: "Xóa thành phần", message: `Xóa “${blockLabel(blocks[index].type)}” khỏi trang? Nội dung của thành phần này sẽ mất khi lưu.`, confirmLabel: "Xóa", tone: "danger" })) return;
    onChange(blocks.filter((_, itemIndex) => itemIndex !== index));
    setOpenIndex((current) => current === null || current === index ? null : current > index ? current - 1 : current);
  }
  function duplicate(index: number) {
    if (uploads.current.size) return;
    onChange([...blocks.slice(0, index + 1), duplicateBlock(blocks[index]), ...blocks.slice(index + 1)]);
    setOpenIndex(index + 1);
  }
  function addLibraryItem(id: string) {
    if (uploads.current.size) return;
    const option = libraryBlockOptions.find((item) => item.id === id);
    if (!option || !canAddType(option.type)) return;
    const block = libraryBlock(id);
    const next = option.type === "hero" ? [block, ...blocks] : [...blocks, block];
    onChange(next);
    setOpenIndex(option.type === "hero" ? 0 : next.length - 1);
  }
  function addPreset(preset: PageBlockPreset) {
    if (uploads.current.size) return;
    const types = preset.types.filter((type) => canAddType(type) && (type !== "hero" || !hasHero));
    const hero = types.includes("hero") ? newBlock("hero") : null;
    const rest = types.filter((type) => type !== "hero").map((type) => newBlock(type));
    const next = hero ? [hero, ...blocks, ...rest] : [...blocks, ...rest];
    onChange(next);
    setOpenIndex(hero ? 0 : blocks.length);
  }

  function renderActions(block: PageBlock, index: number) {
    const pinned = pinnedHero && index === 0;
    return <div className="admin-block__actions">
              <button aria-label={block.isEnabled ? `Ẩn ${blockLabel(block.type)}` : `Hiện ${blockLabel(block.type)}`} aria-pressed={!block.isEnabled} className="admin-content-actions__button" disabled={locked || pinned} onClick={() => update(index, { ...block, isEnabled: !block.isEnabled })} title={block.isEnabled ? "Ẩn khỏi website" : "Hiện trên website"} type="button">{block.isEnabled ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</button>
              <button aria-label={`Nhân bản ${blockLabel(block.type)}`} className="admin-content-actions__button" disabled={locked || block.type === "hero"} onClick={() => duplicate(index)} title={block.type === "hero" ? "Mỗi trang chỉ có một phần đầu trang" : "Nhân bản (chèn bản sao ngay dưới)"} type="button"><CopyPlus aria-hidden="true" /></button>
              <button aria-label={`Xóa ${blockLabel(block.type)}`} className="admin-content-actions__button admin-content-actions__delete" disabled={locked || pinned} onClick={() => void remove(index)} title="Xóa thành phần" type="button"><Trash2 aria-hidden="true" /></button>
            </div>;
  }
  const selectedBlock = openIndex === null ? undefined : blocks[openIndex];
  // Tên mục con đang chọn (thẻ, câu hỏi, gói…) để tiêu đề bảng thuộc tính nói rõ đang sửa cấp nào.
  const activeItem = itemSelection?.section === openIndex ? itemSelection.item : null;
  const childLabel = !selectedBlock || !activeItem || activeItem.path === "component.settings" || activeItem.path === "hero.layout" ? null
    : activeItem.path === "hero.primary" ? "Mục trượt 1"
    : (() => { const item = builderItemCollections(selectedBlock).find(entry => entry.path === activeItem.path)?.items[activeItem.index]; return item ? builderItemLabel(item, activeItem.index) : null; })();
  return <section className={layout === "builder" ? `admin-blocks admin-blocks--split admin-blocks--builder${canvasWide ? " admin-blocks--wide" : ""}` : layout === "split" ? "admin-blocks admin-blocks--split" : "admin-blocks"}>
    <div className="admin-blocks__navigation">
    {layout !== "accordion" ? <h3>Thành phần ({blocks.length})</h3> : null}
    {showGroupPicker && layout !== "builder" && blocks.length === 0 ? <section aria-label="Mẫu bố cục nhanh" className="admin-page-presets">
      <div className="admin-page-presets__heading"><strong>Bố cục nhanh</strong><small>Thêm sẵn một nhóm thành phần theo mục đích trang. Bạn có thể sửa, đổi thứ tự hoặc xóa từng phần sau đó.</small></div>
      <div className="admin-page-presets__grid">{presets.map((preset) => <button disabled={locked} key={preset.id} onClick={() => addPreset(preset)} type="button"><strong>{preset.label}</strong><small>{preset.description}</small><span>{preset.types.filter((type) => canAddType(type) && (type !== "hero" || !hasHero)).length} thành phần</span></button>)}</div>
    </section> : null}
    <ol className="admin-blocks__list" ref={blockList}>
      {leads?.map((lead, leadIndex) => <li className={openIndex === -leadIndex - 1 ? "admin-block admin-block--open" : "admin-block"} id={`page-block--${leadIndex + 1}`} key={`lead-${leadIndex}`}>
        <div className="admin-block__head">
          <span className="admin-drag-handle admin-drag-handle--disabled" />
          <button aria-current={openIndex === -leadIndex - 1 ? "true" : undefined} className="admin-block__toggle" onClick={() => setOpenIndex(-leadIndex - 1)} type="button">
            <ChevronRight aria-hidden="true" className="admin-block__chevron" size={16} />
            <span className="admin-block__index">{leadIndex + 1}</span>
            <strong>{lead.label}</strong>
            <small>Cố định đầu trang</small>
          </button>
        </div>
      </li>)}
      {blocks.map((block, index) => {
        const pinned = pinnedHero && index === 0;
        const open = openIndex === index;
        return <li className={open ? "admin-block admin-block--open" : "admin-block"} id={`page-block-${index}`} key={`${block.type}-${index}`} {...drag.itemProps(index)}>
          <div className="admin-block__head">
            {pinned ? <span className="admin-drag-handle admin-drag-handle--disabled" /> : <button aria-label={`Sắp xếp ${blockLabel(block.type)} ${index + 1}`} className="admin-drag-handle" disabled={locked} {...drag.handleProps(index)} onKeyDown={event => { if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); move(index, event.key === "ArrowUp" ? -1 : 1); } }} title="Kéo để sắp xếp; bàn phím dùng Alt + phím lên/xuống" type="button"><GripVertical aria-hidden="true" size={15} /></button>}
            <button aria-current={layout !== "accordion" && open ? "true" : undefined} aria-expanded={layout === "accordion" ? open : undefined} className="admin-block__toggle" onClick={() => setOpenIndex(layout !== "accordion" ? index : open ? null : index)} type="button">
              <ChevronRight aria-hidden="true" className="admin-block__chevron" size={16} />
              <span className="admin-block__index">{index + (leads?.length ?? 0) + 1}</span>
              <strong>{blockLabel(block.type)}</strong>
              <span className="admin-block__summary">{blockSummary(block)}</span>
              {appearanceTags(block).map((tag) => <span className="admin-block__tag" key={tag.label}>{tag.color ? <i aria-hidden="true" style={{ background: tag.color }} /> : null}{tag.label}</span>)}
              {pinned ? <small>Cố định đầu trang</small> : null}
              {!block.isEnabled ? <AdminStatusBadge>Đang ẩn</AdminStatusBadge> : null}
            </button>
            {layout === "accordion" ? renderActions(block, index) : null}
          </div>
          {open && layout === "builder" ? <BuilderItemsTree block={block} active={itemSelection?.section === index ? itemSelection.item : null} disabled={disabled} readOnly={readOnly} onChange={next => update(index, next)} onSelect={item => setItemSelection(item ? { section: index, item } : null)} /> : null}
          {open && layout === "accordion" ? <BlockBody block={block} disabled={locked} onChange={next => update(index, next)} onUploadingChange={(key, pending) => reportUploading(`${index}:${key}`, pending)} /> : null}
        </li>;
      })}
      {tails?.map((tail, tailIndex) => <li className={openIndex === -tailIndex - 11 ? "admin-block admin-block--open" : "admin-block"} id={`page-block--${tailIndex + 11}`} key={`tail-${tailIndex}`}>
        <div className="admin-block__head">
          <span className="admin-drag-handle admin-drag-handle--disabled" />
          <button aria-current={openIndex === -tailIndex - 11 ? "true" : undefined} className="admin-block__toggle" onClick={() => setOpenIndex(-tailIndex - 11)} type="button">
            <ChevronRight aria-hidden="true" className="admin-block__chevron" size={16} />
            <span className="admin-block__index">{(leads?.length ?? 0) + blocks.length + tailIndex + 1}</span>
            <strong>{tail.label}</strong>
            <small>Cố định cuối trang</small>
          </button>
        </div>
      </li>)}
    </ol>
    {blocks.length === 0 ? <p className="admin-help">Trang chưa có thành phần nào.</p> : null}
    <BlockLibrary disabled={locked} groups={blockGroups} items={libraryItems} onPick={addLibraryItem} showGroupPicker={showGroupPicker && layout !== "builder"} />
    </div>
    {preview}
    {layout !== "accordion" ? <section aria-label="Chỉnh sửa thành phần" className="admin-blocks__detail" ref={detailPanel}>{fixedAt(openIndex) ? <>
      <header><h3>{fixedAt(openIndex)?.label}</h3></header>
      <FixedSectionBody key={openIndex} section={fixedAt(openIndex)!} />
    </> : selectedBlock && openIndex !== null ? <>
      <header><h3>{childLabel ? <><button className="admin-link" onClick={() => setItemSelection(null)} title="Quay lại thiết lập của cả khối" type="button">{blockLabel(selectedBlock.type)}</button> › <span>{childLabel}</span></> : blockLabel(selectedBlock.type)}</h3>{renderActions(selectedBlock, openIndex)}</header>
      <BlockBody itemSelection={itemSelection?.section === openIndex ? itemSelection.item : selectedBlock.type === "hero" ? heroLayoutSelection : componentSettingsSelection} key={`${selectedBlock.type}-${openIndex}`} block={selectedBlock} disabled={locked} onChange={next => update(openIndex, next)} onUploadingChange={(key, pending) => reportUploading(`${openIndex}:${key}`, pending)} />
    </> : <p className="admin-help">Thêm thành phần để bắt đầu nhập nội dung.</p>}</section> : null}
  </section>;
}
