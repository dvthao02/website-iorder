import { z } from "zod";

// Gmail báo liên hệ mới (CMS → Cài đặt → Kết nối & khóa API). Tệp này an toàn cho cả trình duyệt: chỉ có kiểu và schema.
// Token OAuth KHÔNG nằm ở đây: nó được mã hóa trong kho khóa (secrets, khóa `gmail_refresh_token`).

/** Đường dẫn CMS mà Google chuyển người dùng về sau khi cấp quyền. Địa chỉ đầy đủ (kèm tên miền CMS) phải được đăng ký ở Google Cloud. */
export const gmailCallbackPath = "/admin/integrations/gmail/callback";

export const maxGmailCc = 10;

const emailAddress = z.string().trim().toLowerCase().max(254, "Địa chỉ email quá dài.").pipe(z.email("Địa chỉ email không hợp lệ."));

/** Cài đặt do Super Admin sửa (site_settings.gmail_notifications, có version). */
export const gmailSettingsSchema = z.object({
  /** Bật gửi thư mỗi khi có liên hệ mới từ website. */
  enabled: z.boolean(),
  /** Các địa chỉ nhận bản sao (CC). Thư gửi từ chính Gmail đã kết nối tới chính nó, nên người nhận chính luôn là tài khoản đó. */
  cc: z.array(emailAddress).max(maxGmailCc, `Tối đa ${maxGmailCc} địa chỉ CC.`).refine((list) => new Set(list).size === list.length, "Địa chỉ CC bị trùng."),
}).strict();
export type GmailSettings = z.infer<typeof gmailSettingsSchema>;
export const defaultGmailSettings: GmailSettings = { enabled: false, cc: [] };

export const gmailSettingsUpdateSchema = z.object({
  enabled: z.boolean(),
  cc: gmailSettingsSchema.shape.cc,
  expectedVersion: z.number().int().min(0),
}).strict();

/** Thông tin kết nối do máy chủ ghi (site_settings.gmail_connection); không có token. */
export const gmailConnectionSchema = z.object({
  email: z.string().max(254),
  /** connected: dùng được; needs_reconnect: Google từ chối token (đã thu hồi quyền, đổi mật khẩu Google…) nên phải bấm Kết nối lại. */
  status: z.enum(["connected", "needs_reconnect"]),
  connectedAt: z.iso.datetime(),
  /** Tên miền CMS lúc kết nối, dùng dựng liên kết "Mở trong CMS" trong thư. */
  cmsOrigin: z.string().max(200),
  lastSentAt: z.iso.datetime().nullable(),
  lastError: z.string().max(300).nullable(),
  lastErrorAt: z.iso.datetime().nullable(),
}).strict();
export type GmailConnection = z.infer<typeof gmailConnectionSchema>;

/** Trạng thái cho màn CMS: không có giá trị bí mật nào. */
export const gmailStatusSchema = z.object({
  /** Đã có cả Client ID và Client secret (ở CMS hoặc biến môi trường). */
  clientConfigured: z.boolean(),
  connection: gmailConnectionSchema.nullable(),
  settings: gmailSettingsSchema,
  version: z.number().int().min(0),
  callbackPath: z.literal(gmailCallbackPath),
}).strict();
export type GmailStatus = z.infer<typeof gmailStatusSchema>;

const password = z.string().min(1, "Cần nhập mật khẩu để xác nhận.").max(256);

/** Một endpoint POST, phân biệt bằng `action`. */
export const gmailActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect"), password, redirectUri: z.url().max(300) }).strict(),
  z.object({ action: z.literal("finish"), code: z.string().min(1).max(2_000), state: z.string().min(16).max(200) }).strict(),
  z.object({ action: z.literal("disconnect"), password }).strict(),
  z.object({ action: z.literal("test") }).strict(),
]);
export type GmailAction = z.infer<typeof gmailActionSchema>;
