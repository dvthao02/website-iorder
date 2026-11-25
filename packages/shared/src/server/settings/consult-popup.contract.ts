import { z } from "zod";

import { isPopupExternalLink } from "./popup-link";

// Đường dẫn nội bộ ("/contact"), liên kết ngoài http(s), số điện thoại "tel:" hoặc email "mailto:".
// Chặn "javascript:", "data:" và "//host".
const internalPath = (value: string) => value.startsWith("/") && !value.startsWith("//") && !/\s/.test(value);
export { isPopupExternalLink };
const contactLink = (value: string) => /^tel:[+\d().-]{3,30}$/i.test(value) || /^mailto:[^\s@]+@[^\s@]+$/i.test(value);
export const popupLinkSchema = z.string().trim().max(1_000).refine(
  (value) => internalPath(value) || isPopupExternalLink(value) || contactLink(value),
  "Nhập đường dẫn nội bộ (ví dụ /contact), liên kết ngoài bắt đầu bằng https://, hoặc tel:/mailto:.",
);

const displayFields = {
  scrollPercent: z.number().int().min(30).max(100),
  delaySeconds: z.number().int().min(0).max(300),
  repeatDays: z.number().int().min(0).max(365),
  scope: z.enum(["all", "home"]),
};

export const consultFormSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable(),
  submitLabel: z.string().trim().min(1).max(60),
  needOptions: z.array(z.string().trim().min(1).max(120)).max(10),
  ...displayFields,
}).strict();

export const promotionPopupSchema = z.object({
  enabled: z.boolean(),
  layout: z.enum(["card", "image", "split", "compact", "bar"]),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable(),
  mediaId: z.string().uuid().nullable(),
  actionLabel: z.string().trim().max(60).nullable(),
  actionUrl: popupLinkSchema.nullable(),
  ...displayFields,
}).strict().superRefine((value, ctx) => {
  if (!value.enabled) return;
  if (!value.actionUrl) ctx.addIssue({ code: "custom", path: ["actionUrl"], message: "Quảng cáo cần đường dẫn khi khách bấm vào." });
  if ((value.layout === "image" || value.layout === "split") && !value.mediaId) {
    ctx.addIssue({ code: "custom", path: ["mediaId"], message: "Bố cục quảng cáo đã chọn cần có ảnh." });
  }
  if (value.layout !== "image" && !value.actionLabel) {
    ctx.addIssue({ code: "custom", path: ["actionLabel"], message: "Mẫu quảng cáo này cần chữ trên nút bấm." });
  }
});

export type ConsultFormSettings = z.infer<typeof consultFormSchema>;
export type PromotionPopupSettings = z.infer<typeof promotionPopupSchema>;

export const consultPopupSchema = z.object({ form: consultFormSchema, promo: promotionPopupSchema }).strict();
export type ConsultPopup = z.infer<typeof consultPopupSchema>;

const defaultDisplay = { scrollPercent: 85, delaySeconds: 8, repeatDays: 3, scope: "all" as const };

export const defaultConsultForm: ConsultFormSettings = {
  enabled: true,
  title: "Cần tư vấn giải pháp cho cửa hàng?",
  description: "Để lại tên và số điện thoại, iOrder sẽ gọi lại trong giờ làm việc.",
  submitLabel: "Gửi yêu cầu tư vấn",
  needOptions: ["Phần mềm bán hàng", "Thiết bị bán hàng", "Triển khai cho nhiều chi nhánh", "Khác"],
  ...defaultDisplay,
};

export const defaultPromotionPopup: PromotionPopupSettings = {
  enabled: false,
  layout: "card",
  title: "Quảng cáo iOrder",
  description: null,
  mediaId: null,
  actionLabel: null,
  actionUrl: null,
  ...defaultDisplay,
};

export const defaultConsultPopup: ConsultPopup = { form: defaultConsultForm, promo: defaultPromotionPopup };

// Dòng `consult_popup` cũ từng gộp hai tính năng và dùng chung lịch hiển thị.
// Chỉ đọc để chuyển tiếp; mọi lần lưu mới đi vào hai khóa độc lập `consult_form` và `promotion_popup`.
const oldCombinedSchema = z.object({
  form: consultFormSchema.omit({ scrollPercent: true, delaySeconds: true, repeatDays: true, scope: true }),
  promo: z.object({
    enabled: z.boolean(),
    layout: z.enum(["card", "image", "split", "compact", "bar"]),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(400).nullable(),
    mediaId: z.string().uuid().nullable(),
    actionLabel: z.string().trim().max(60).nullable(),
    actionUrl: popupLinkSchema.nullable(),
  }).strict(),
  ...displayFields,
}).strict();

const oldestSchema = z.object({
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
  ...displayFields,
}).strict();

function upgradeStoredPopup(input: unknown) {
  const current = consultPopupSchema.safeParse(input);
  if (current.success) return current.data;

  const oldCombined = oldCombinedSchema.safeParse(input);
  if (oldCombined.success) {
    const { form, promo, scrollPercent, delaySeconds, repeatDays, scope } = oldCombined.data;
    const display = { scrollPercent, delaySeconds, repeatDays, scope };
    return { form: { ...form, ...display }, promo: { ...promo, ...display } };
  }

  const oldest = oldestSchema.safeParse(input);
  if (!oldest.success) return input;
  const legacy = oldest.data;
  const display = { scrollPercent: legacy.scrollPercent, delaySeconds: legacy.delaySeconds, repeatDays: legacy.repeatDays, scope: legacy.scope };
  return {
    form: {
      ...defaultConsultForm,
      ...display,
      enabled: legacy.enabled && legacy.mode === "form",
      title: legacy.mode === "form" ? legacy.title : defaultConsultForm.title,
      description: legacy.mode === "form" ? legacy.description : defaultConsultForm.description,
      submitLabel: legacy.submitLabel,
      needOptions: legacy.needOptions,
    },
    promo: {
      ...defaultPromotionPopup,
      ...display,
      enabled: legacy.enabled && legacy.mode === "promo",
      layout: legacy.promoLayout,
      title: legacy.mode === "promo" ? legacy.title : defaultPromotionPopup.title,
      description: legacy.mode === "promo" ? legacy.description : null,
      mediaId: legacy.mediaId,
      actionLabel: legacy.actionLabel,
      actionUrl: legacy.actionUrl,
    },
  };
}

export const storedConsultPopupSchema = z.preprocess(upgradeStoredPopup, consultPopupSchema);
