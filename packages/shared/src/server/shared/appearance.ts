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
// (trang chủ: mỗi phần một màn hình trên máy tính; trang khác: theo nội dung); "auto" = luôn theo nội dung.
export const blockHeightSchema = z.enum(["default", "auto", "screen", "three_quarter", "half"]);
// Nội dung nằm ở đâu khi phần cao hơn nội dung.
export const blockVerticalAlignSchema = z.enum(["top", "center", "bottom"]);
// Bố cục phần đầu trang chi tiết (sản phẩm, dịch vụ, thiết bị): vị trí ảnh, chiều cao, nền. Phần đầu trang không phải khối nên không dùng vỏ chung.
export const detailHeroLayoutSchema = z.object({
  layout: z.enum(["split", "split_reverse", "centered"]).default("split"),
  height: z.enum(["screen", "auto"]).default("screen"),
  background: z.enum(["default", "white", "tinted"]).default("default"),
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
  verticalAlign: blockVerticalAlignSchema.optional(),
}).strict();
export type BlockAppearance = z.infer<typeof blockAppearanceSchema>;
export type BlockTone = z.infer<typeof blockToneSchema>;
export type BlockSpacing = z.infer<typeof blockSpacingSchema>;
export type BlockHeight = z.infer<typeof blockHeightSchema>;
export type BlockVerticalAlign = z.infer<typeof blockVerticalAlignSchema>;

// Màu nền riêng của một thẻ con (thẻ lưới, gói giá, nhóm danh sách); null/thiếu = thẻ trắng mặc định.
export const cardBackgroundSchema = hexColorSchema.nullable().optional();
