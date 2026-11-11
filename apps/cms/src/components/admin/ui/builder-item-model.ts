import type { PageBlock } from "@iorder/core/server/pages/pages.contract";

export type BuilderItem = Record<string, unknown>;
export type BuilderItemSelection = { path: string; index: number; heading: string; tab: "content" | "media"; parentIndex?: number; focus?: boolean };
export type BuilderItemCollection = Omit<BuilderItemSelection, "index"> & { label: string; noun: string; items: BuilderItem[]; max: number; min: number; kind?: "text"; create: () => BuilderItem };

function read(block: PageBlock, path: string): BuilderItem[] {
  let value: unknown = block.data;
  for (const key of path.split(".")) value = value && typeof value === "object" ? Reflect.get(value, key) : undefined;
  return Array.isArray(value) ? value.flatMap(item => typeof item === "string" ? [{ label: item }] : item && typeof item === "object" && !Array.isArray(item) ? [item as BuilderItem] : []) : [];
}
export function replaceBuilderItems(block: PageBlock, path: string, items: BuilderItem[]): PageBlock {
  if (!/^(items|plans(?:\.\d+\.features)?|bullets|needOptions|slides|panels(?:\.\d+\.highlights)?|highlights|groups(?:\.\d+\.items)?)$/.test(path)) throw new Error("Nhóm mục không hợp lệ.");
  const next = structuredClone(block);
  const parts = path.split(".");
  let target: object = next.data;
  for (const key of parts.slice(0, -1)) { const nested: unknown = Reflect.get(target, key); if (!nested || typeof nested !== "object") throw new Error("Không tìm thấy nhóm mục."); target = nested; }
  const text = /^(bullets|needOptions|plans\.\d+\.features)$/.test(path);
  Reflect.set(target, parts.at(-1)!, text ? items.map(item => typeof item.label === "string" ? item.label : "") : items);
  return next;
}
export function builderItemLabel(item: BuilderItem, index: number) {
  const label = [item.title, item.name, item.question, item.label].find(value => typeof value === "string" && value.trim());
  return typeof label === "string" ? label : `Mục ${index + 1}`;
}
export function builderItemCollections(block: PageBlock): BuilderItemCollection[] {
  const collection = (path: string, label: string, heading: string, noun: string, max: number, min: number, create: () => BuilderItem, tab: "content" | "media" = "content", parentIndex?: number): BuilderItemCollection => ({ path, label, heading, noun, items: read(block, path), max, min, create, tab, parentIndex });
  switch (block.type) {
    case "features": case "industries": case "ecosystem": case "process": return [collection("items", "Các thẻ", "Các thẻ", "thẻ", 30, 0, () => ({ title: "Thẻ mới", description: "", href: null, isEnabled: true }))];
    case "stats": return [collection("items", "Các số liệu", "Các số liệu", "số liệu", 12, 1, () => ({ value: "0", label: "Số liệu mới", note: null, isEnabled: true }))];
    case "faq": return [collection("items", "Câu hỏi và trả lời", "Câu hỏi và trả lời", "câu hỏi", 40, 1, () => ({ question: "Câu hỏi mới", answer: "", isEnabled: true }))];
    case "media_text": return [{ ...collection("bullets", "Điểm nổi bật", "Danh sách có dấu ✓", "dòng", 8, 0, () => ({ label: "Nội dung mới" })), kind: "text" }];
    case "lead_form": return [{ ...collection("needOptions", "Nhu cầu tư vấn", "Nhu cầu để khách hàng chọn", "nhu cầu", 20, 0, () => ({ label: "Nhu cầu mới" })), kind: "text" }];
    case "pricing": return [collection("plans", "Các gói", "Các gói", "gói", 4, 1, () => ({ name: "Gói mới", price: "Liên hệ", period: null, description: null, features: [], action: null, highlighted: false, badge: null, isEnabled: true })), ...block.data.plans.map((plan, index) => ({ ...collection(`plans.${index}.features`, "Tính năng", `Tính năng của gói ${index + 1}`, "tính năng", 20, 0, () => ({ label: "Tính năng mới" })), kind: "text" as const }))];
    case "hero": return [
      collection("highlights", "Điểm nổi bật", "Điểm nổi bật của mục 1", "điểm nổi bật", 4, 0, () => ({ title: "Điểm nổi bật mới", note: null, isEnabled: true })),
      ...(block.data.layout === "slider" ? [collection("slides", "Ảnh trượt", "Các ảnh trượt", "ảnh trượt", 8, 0, () => ({ mediaId: "", title: null, description: null, action: null, isEnabled: true }), "content")] : [collection("panels", "Mục trượt bổ sung", "Các mục trượt bổ sung", "mục trượt", 7, 0, () => ({ eyebrow: null, title: "Khối nội dung mới", description: null, primaryAction: null, secondaryAction: null, mediaId: null, highlights: [], isEnabled: true }), "content"), ...block.data.panels.map((panel, index) => ({ ...collection(`panels.${index}.highlights`, `Điểm nổi bật · ${panel.title}`, `Điểm nổi bật của mục ${index + 2}`, "điểm nổi bật", 4, 0, () => ({ title: "Điểm nổi bật mới", note: null, isEnabled: true })), items: panel.highlights ?? block.data.highlights }))]),
    ];
    case "grouped_list": return [collection("groups", "Các nhóm", "Các nhóm", "nhóm", 6, 1, () => ({ title: "Nhóm mới", icon: null, items: [], action: null, isEnabled: true })), ...block.data.groups.map((group, index) => collection(`groups.${index}.items`, group.title || `Nhóm ${index + 1}`, "Các nhóm", "mục", 30, 0, () => ({ label: "Mục mới", icon: null, href: null, isEnabled: true }), "content", index))];
    default: return [];
  }
}
