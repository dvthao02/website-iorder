import { z } from "zod";

// Đường dẫn nội bộ ("/lien-he"), liên kết ngoài http(s), số điện thoại "tel:" hoặc email "mailto:".
// Chặn "javascript:", "data:" và "//host".
const internalPath = (value: string) => value.startsWith("/") && !value.startsWith("//") && !/\s/.test(value);
export const isPopupExternalLink = (value: string) => /^https?:\/\/[^\s]+$/i.test(value);
const contactLink = (value: string) => /^tel:[+\d().-]{3,30}$/i.test(value) || /^mailto:[^\s@]+@[^\s@]+$/i.test(value);
export const popupLinkSchema = z.string().trim().max(1_000).refine(
  (value) => internalPath(value) || isPopupExternalLink(value) || contactLink(value),
  "Nhập đường dẫn nội bộ (ví dụ /lien-he), liên kết ngoài bắt đầu bằng https://, hoặc tel:/mailto:.",
);

const formSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable(),
  submitLabel: z.string().trim().min(1).max(60),
  needOptions: z.array(z.string().trim().min(1).max(120)).max(10),
}).strict();

const promoSchema = z.object({
  enabled: z.boolean(),
  layout: z.enum(["card", "image"]),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable(),
  mediaId: z.string().uuid().nullable(),
  actionLabel: z.string().trim().max(60).nullable(),
  actionUrl: popupLinkSchema.nullable(),
}).strict();

const currentSchema = z.object({
  form: formSchema,
  promo: promoSchema,
  scrollPercent: z.number().int().min(30).max(100),
  delaySeconds: z.number().int().min(0).max(300),
  repeatDays: z.number().int().min(0).max(365),
  scope: z.enum(["all", "home"]),
}).strict().superRefine((value, ctx) => {
  if (!value.promo.enabled) return;
  if (!value.promo.actionUrl) ctx.addIssue({ code: "custom", path: ["promo", "actionUrl"], message: "Quảng cáo cần đường dẫn khi khách bấm vào." });
  if (value.promo.layout === "image") {
    if (!value.promo.mediaId) ctx.addIssue({ code: "custom", path: ["promo", "mediaId"], message: "Quảng cáo chỉ ảnh cần chọn ảnh." });
  } else if (!value.promo.actionLabel) ctx.addIssue({ code: "custom", path: ["promo", "actionLabel"], message: "Quảng cáo dạng thẻ cần chữ trên nút bấm." });
});

const legacySchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["form", "promo"]),
  promoLayout: z.enum(["card", "image"]).default("card"),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable(),
  submitLabel: z.string().trim().min(1).max(60),
  needOptions: z.array(z.string().trim().min(1).max(120)).max(10),
  mediaId: z.string().uuid().nullable(),
  actionLabel: z.string().trim().max(60).nullable(),
  actionUrl: popupLinkSchema.nullable(),
  scrollPercent: z.number().int().min(30).max(100),
  delaySeconds: z.number().int().min(0).max(300),
  repeatDays: z.number().int().min(0).max(365),
  scope: z.enum(["all", "home"]),
}).strict();

const defaultForm = {
  title: "Cần tư vấn giải pháp cho cửa hàng?",
  description: "Để lại tên và số điện thoại, iOrder sẽ gọi lại trong giờ làm việc.",
  submitLabel: "Gửi yêu cầu tư vấn",
  needOptions: ["Phần mềm bán hàng", "Thiết bị bán hàng", "Triển khai cho nhiều chi nhánh", "Khác"],
};

function fromLegacy(input: unknown) {
  const parsed = legacySchema.safeParse(input);
  if (!parsed.success) return input;
  const legacy = parsed.data;
  return {
    form: {
      // Cấu hình cũ dùng chế độ loại trừ. Khi đã chọn quảng cáo, giữ luôn biểu mẫu mặc định
      // để lần nâng cấp đầu tiên có đủ hai nội dung như màn quản lý mới.
      enabled: legacy.enabled,
      title: legacy.mode === "form" ? legacy.title : defaultForm.title,
      description: legacy.mode === "form" ? legacy.description : defaultForm.description,
      submitLabel: legacy.submitLabel,
      needOptions: legacy.needOptions,
    },
    promo: {
      enabled: legacy.enabled && legacy.mode === "promo",
      layout: legacy.promoLayout,
      title: legacy.mode === "promo" ? legacy.title : "Quảng cáo iOrder",
      description: legacy.mode === "promo" ? legacy.description : null,
      mediaId: legacy.mediaId,
      actionLabel: legacy.actionLabel,
      actionUrl: legacy.actionUrl,
    },
    scrollPercent: legacy.scrollPercent,
    delaySeconds: legacy.delaySeconds,
    repeatDays: legacy.repeatDays,
    scope: legacy.scope,
  };
}

// Dữ liệu cũ chỉ có một `mode` vẫn được đọc và chuyển sang cấu trúc hai mục độc lập.
export const consultPopupSchema = z.preprocess(fromLegacy, currentSchema);
export type ConsultPopup = z.infer<typeof currentSchema>;

export const defaultConsultPopup: ConsultPopup = {
  form: { enabled: true, ...defaultForm },
  promo: {
    enabled: false,
    layout: "card",
    title: "Quảng cáo iOrder",
    description: null,
    mediaId: null,
    actionLabel: null,
    actionUrl: null,
  },
  scrollPercent: 85,
  delaySeconds: 8,
  repeatDays: 3,
  scope: "all",
};
