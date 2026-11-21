import { z } from "zod";

// Đổi mật khẩu của chính tài khoản đang đăng nhập; độ dài tối thiểu khớp với mật khẩu khi tạo tài khoản.
// Thanh báo độ mạnh ở CMS lấy cùng hằng số này để không bao giờ báo "đạt" khi máy chủ sẽ từ chối.
export const ownPasswordMinLength = 10;
export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại.").max(1_024),
  newPassword: z.string().min(ownPasswordMinLength, `Mật khẩu mới cần ít nhất ${ownPasswordMinLength} ký tự.`).max(1_024),
}).strict().refine((value) => value.currentPassword !== value.newPassword, { path: ["newPassword"], message: "Mật khẩu mới phải khác mật khẩu hiện tại." });

export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;

// Ô nhập để trống (chuỗi rỗng) nghĩa là xóa giá trị. Thiếu hẳn trường thì là lỗi, để API không xóa nhầm khi client quên gửi.
const blankToNull = (value: unknown) => typeof value === "string" && value.trim() === "" ? null : value;

export const phonePattern = /^[0-9+().\-\s]{6,30}$/;
const phoneMessage = "Số điện thoại chỉ gồm chữ số, dấu +, khoảng trắng, ( ) . - và dài 6–30 ký tự.";

/**
 * Hồ sơ tài khoản tự cập nhật ở "Tài khoản của tôi". Tên đăng nhập, vai trò và trạng thái do quản trị viên
 * quản lý ở mục Người dùng CMS nên không nằm ở đây; ảnh đại diện có đường tải lên riêng.
 */
export const updateOwnProfileSchema = z.object({
  fullName: z.string({ error: "Nhập họ và tên." }).trim().min(1, "Nhập họ và tên.").max(180, "Họ và tên tối đa 180 ký tự."),
  email: z.preprocess(blankToNull, z.string({ error: "Thiếu email." }).trim().email("Email chưa đúng định dạng.").max(320, "Email tối đa 320 ký tự.").nullable()),
  phone: z.preprocess(blankToNull, z.string({ error: "Thiếu số điện thoại." }).trim().regex(phonePattern, phoneMessage)
    .refine((value) => value.replace(/\D/g, "").length >= 6, "Số điện thoại cần ít nhất 6 chữ số.").nullable()),
}).strict();

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

export class ProfileEmailInUseError extends Error {
  constructor() {
    super("Email này đang được tài khoản khác sử dụng.");
    this.name = "ProfileEmailInUseError";
  }
}

export class AccountUnavailableError extends Error {
  constructor() {
    super("Tài khoản không còn hoạt động.");
    this.name = "AccountUnavailableError";
  }
}

export class CurrentPasswordMismatchError extends Error {
  constructor() {
    super("Mật khẩu hiện tại không đúng.");
    this.name = "CurrentPasswordMismatchError";
  }
}
