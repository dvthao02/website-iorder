import { z } from "zod";

// Giao diện dùng chung cho mọi phần trang (khối trang, phần đầu trang, các phần của trang sản phẩm) và thẻ con:
// nền (tự động / trắng / xanh nhạt / tối / màu tự chọn), ảnh nền phủ lớp màu, độ rộng nội dung, khoảng cách, mã neo.
// Website tự chọn chữ trắng hay chữ đậm theo độ sáng của màu (isDarkColor), người vận hành không phải chọn màu chữ.

export const hexColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Màu phải là mã màu dạng #RRGGBB.").transform((value) => value.toLowerCase());

export { isDarkColor } from "./color";

// "auto" = website tự quyết theo quy luật chung (xem pages/block-layout.ts): nền xen kẽ trắng / xanh nhạt, khoảng cách vừa.
// "custom" = màu nền tự chọn (backgroundColor).
export const blockToneSchema = z.enum(["auto", "white", "tinted", "dark", "custom"]);
export const blockSpacingSchema = z.enum(["auto", "sm", "md", "lg"]);
// Độ rộng phần nội dung: % khung chuẩn (null = mặc định). Điện thoại luôn rộng hết khung.
export const blockWidthLimits = { min: 40, max: 100 } as const;
export const blockOverlayLimits = { min: 0, max: 95 } as const;
// Chiều cao tối thiểu của phần (so với vùng nhìn dưới header). Thiếu / "default" = theo nhịp chung của trang
// (mọi trang hiện nay: theo nội dung, trang chủ dùng nhịp khoảng cách chuẩn; chỉ trang bật `screens` mới mỗi phần một màn hình); "auto" = luôn theo nội dung.
// "custom" = chiều cao tối thiểu do người vận hành đặt (appearance.minHeight + minHeightUnit): px cố định, % chiều cao màn hình (vh),
// hoặc tỉ lệ khung (chiều cao = % bề ngang: 56 ≈ 16:9, 100 = vuông).
export const blockHeightSchema = z.enum(["default", "auto", "screen", "three_quarter", "half", "custom"]);
export const blockMinHeightUnitSchema = z.enum(["px", "vh", "ratio"]);
export const blockMinHeightLimits = {
  px: { min: 120, max: 1600, step: 20, fallback: 480 },
  vh: { min: 20, max: 100, step: 5, fallback: 60 },
  ratio: { min: 25, max: 100, step: 1, fallback: 56 },
} as const;
export type BlockMinHeightUnit = z.infer<typeof blockMinHeightUnitSchema>;
/** Chiều cao tùy chỉnh đã kẹp vào khoảng cho phép của đơn vị; thiếu thì dùng mặc định (480px). */
export function resolveCustomHeight(appearance: { minHeight?: number; minHeightUnit?: BlockMinHeightUnit } | null | undefined): { value: number; unit: BlockMinHeightUnit } {
  const unit = appearance?.minHeightUnit ?? "px";
  const limits = blockMinHeightLimits[unit];
  const raw = appearance?.minHeight ?? limits.fallback;
  return { value: Math.min(limits.max, Math.max(limits.min, Math.round(raw))), unit };
}
// Nội dung nằm ở đâu khi phần cao hơn nội dung.
export const blockVerticalAlignSchema = z.enum(["top", "center", "bottom"]);
// Bố cục phần đầu trang chi tiết (sản phẩm, dịch vụ, thiết bị): vị trí ảnh, chiều cao, nền. Phần đầu trang không phải khối nên không dùng
// vỏ chung cho cả bố cục; `appearance` chỉ dùng phần nền của vỏ chung (màu tự chọn, ảnh nền, lớp phủ) giống phần đầu trang của Trang.
export const detailHeroLayoutSchema = z.object({
  layout: z.enum(["split", "split_reverse", "centered", "background"]).default("split"),
  height: z.enum(["screen", "three_quarter", "half", "auto", "custom"]).default("screen"),
  background: z.enum(["default", "white", "tinted", "dark"]).default("default"),
  // Ảnh trượt thêm (ngoài ảnh bìa): từ 2 ảnh thì phần đầu trang tự chuyển ảnh, kể cả khi dùng "Ảnh nền tràn màn hình".
  extraMediaIds: z.array(z.string().uuid()).max(7).default([]),
  appearance: z.lazy(() => blockAppearanceSchema).optional(),
}).strict();
export type DetailHeroLayout = z.infer<typeof detailHeroLayoutSchema>;
export const blockAppearanceSchema = z.object({
  anchor: z.string().trim().max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable().default(null),
  tone: blockToneSchema.default("auto"),
  spacing: blockSpacingSchema.default("auto"),
  width: z.number().int().min(blockWidthLimits.min).max(blockWidthLimits.max).nullable().default(null),
  backgroundColor: hexColorSchema.nullable().default(null),
  // Ảnh nền từ Thư viện media, phủ một lớp màu nền (backgroundOverlay % độ đậm) để chữ luôn đọc được.
  backgroundMediaId: z.string().uuid().nullable().default(null),
  backgroundOverlay: z.number().int().min(blockOverlayLimits.min).max(blockOverlayLimits.max).default(80),
  // Tùy chọn, không có mặc định: dữ liệu cũ giữ nguyên hình dạng khi đọc lại.
  height: blockHeightSchema.optional(),
  minHeight: z.number().int().min(blockMinHeightLimits.ratio.min).max(blockMinHeightLimits.px.max).optional(),
  minHeightUnit: blockMinHeightUnitSchema.optional(),
  // Chỉ dùng cho phần cố định của trang chi tiết (thông số, nội dung liên quan, dải tư vấn…): ẩn khỏi website. Khối trang dùng isEnabled.
  hidden: z.boolean().optional(),
  // Khóa chỉnh sửa trong CMS (khối trang và phần cố định): form bị khóa, không ẩn/xóa/kéo thả được cho tới khi mở khóa. Website bỏ qua.
  locked: z.boolean().optional(),
  // Tên nhận diện trong CMS, không dùng làm tiêu đề trên website.
  adminLabel: z.string().trim().max(120).optional(),
  verticalAlign: blockVerticalAlignSchema.optional(),
}).strict();
export type BlockAppearance = z.infer<typeof blockAppearanceSchema>;
export type BlockTone = z.infer<typeof blockToneSchema>;
export type BlockSpacing = z.infer<typeof blockSpacingSchema>;
export type BlockHeight = z.infer<typeof blockHeightSchema>;
export type BlockVerticalAlign = z.infer<typeof blockVerticalAlignSchema>;

// Màu nền riêng của một thẻ con (thẻ lưới, gói giá, nhóm danh sách); null/thiếu = thẻ trắng mặc định.
export const cardBackgroundSchema = hexColorSchema.nullable().optional();
