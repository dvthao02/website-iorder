import type { PageBlock } from "./pages.contract";

// Lọc sau khi đã validate dữ liệu lưu; giữ nguyên bản gốc để khôi phục/nhân bản/đổi thứ tự.
export function visibleBlockItems(block: PageBlock): PageBlock {
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.filter(item => !item || typeof item !== "object" || !("isEnabled" in item) || item.isEnabled !== false).map(visit);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, visit(nested)]));
    return value;
  }
  return { ...block, data: visit(block.data) } as PageBlock;
}
