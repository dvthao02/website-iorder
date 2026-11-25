// Chiều cao tối thiểu tùy chỉnh của phần trang. Không import zod: file này được mã phía trình duyệt của website dùng (xem appearance.ts).

export type BlockMinHeightUnit = "px" | "vh" | "ratio";
export const blockMinHeightLimits = {
  px: { min: 120, max: 1600, step: 20, fallback: 480 },
  vh: { min: 20, max: 100, step: 5, fallback: 60 },
  ratio: { min: 25, max: 100, step: 1, fallback: 56 },
} as const;
/** Chiều cao tùy chỉnh đã kẹp vào khoảng cho phép của đơn vị; thiếu thì dùng mặc định (480px). */
export function resolveCustomHeight(appearance: { minHeight?: number; minHeightUnit?: BlockMinHeightUnit } | null | undefined): { value: number; unit: BlockMinHeightUnit } {
  const unit = appearance?.minHeightUnit ?? "px";
  const limits = blockMinHeightLimits[unit];
  const raw = appearance?.minHeight ?? limits.fallback;
  return { value: Math.min(limits.max, Math.max(limits.min, Math.round(raw))), unit };
}
