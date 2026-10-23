import { z } from "zod";

// Bảng giá dùng chung: khối "Bảng giá" của trang và bảng giá trên trang chi tiết sản phẩm/dịch vụ.
// 1–4 gói; gói "nổi bật" được làm to và có nhãn.
const pricingActionSchema = z.object({ label: z.string().trim().min(1).max(120), href: z.string().trim().min(1).max(1000) }).strict();

export const pricingDataSchema = z.object({
  eyebrow: z.string().trim().max(160).nullable(),
  title: z.string().trim().min(1).max(220),
  description: z.string().trim().max(2_000).nullable(),
  note: z.string().trim().max(300).nullable(),
  plans: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    price: z.string().trim().min(1).max(60),
    period: z.string().trim().max(60).nullable(),
    description: z.string().trim().max(300).nullable(),
    features: z.array(z.string().trim().min(1).max(200)).max(20),
    action: pricingActionSchema.nullable(),
    highlighted: z.boolean(),
    badge: z.string().trim().max(40).nullable(),
  }).strict()).min(1).max(4),
}).strict();

export type PricingData = z.infer<typeof pricingDataSchema>;
