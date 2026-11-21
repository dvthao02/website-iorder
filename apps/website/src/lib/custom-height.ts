import type { CSSProperties } from "react";
import { resolveCustomHeight, type BlockMinHeightUnit } from "@iorder/shared/server/shared/appearance";

/**
 * Chiều cao tùy chỉnh (CMS: Chiều cao phần › Tùy chỉnh) thành biến CSS cho globals.css.
 * px: cố định; vh: % chiều cao màn hình (svh); ratio: chiều cao = % bề ngang, tức tỉ lệ khung (CSS aspect-ratio, nội dung dài hơn thì tự dài ra).
 * Phần đầu trang nằm dưới header trong suốt nên px được cộng thêm chiều cao header (số px là phần nhìn thấy).
 */
export function customHeight(kind: "section" | "hero", source: { minHeight?: number; minHeightUnit?: BlockMinHeightUnit } | null | undefined): { style: CSSProperties; ratio: boolean } {
  const { value, unit } = resolveCustomHeight(source);
  const name = kind === "hero" ? "--hero" : "--section";
  if (unit === "ratio") return { style: { [`${name}-ratio`]: `100 / ${value}` } as CSSProperties, ratio: true };
  const size = unit === "vh" ? `${value}svh` : kind === "hero" ? `calc(${value}px + var(--header-height))` : `${value}px`;
  return { style: { [`${name}-min-height`]: size } as CSSProperties, ratio: false };
}
