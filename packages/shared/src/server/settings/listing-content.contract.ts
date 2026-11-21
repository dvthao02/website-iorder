import { z } from "zod";
const entry = z.object({ eyebrow: z.string().trim().min(1).max(160), title: z.string().trim().min(1).max(220), description: z.string().trim().max(2_000).nullable() }).strict();
const defaultGuides = { eyebrow: "Trung tâm trợ giúp", title: "Hướng dẫn sử dụng iOrder", description: "Tài liệu hướng dẫn thiết lập, bán hàng, kho, hóa đơn điện tử và vận hành iOrder." };
export const listingContentSchema = z.object({ news: entry, support: entry, equipment: entry, guides: entry.default(defaultGuides) }).strict();
export type ListingContent = z.infer<typeof listingContentSchema>;
