import type { ReactNode } from "react";

/**
 * Trong canvas CMS, bọc một phần nằm ngoài danh sách khối (phần đầu trang, thông số…) để bấm chọn được:
 * mục thứ i của trình dựng nhận chỉ số -(i + 1). Ngoài canvas không bọc để trang công khai giữ nguyên cấu trúc HTML.
 */
export function BuilderAnchor({ active, index, children }: { active: boolean; index: number; children: ReactNode }) {
  return active ? <div data-builder-block={index}>{children}</div> : <>{children}</>;
}
