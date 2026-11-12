import { z } from "zod";

// Đổi mật khẩu của chính tài khoản đang đăng nhập; độ dài tối thiểu khớp với mật khẩu khi tạo tài khoản.
export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại.").max(1_024),
  newPassword: z.string().min(10, "Mật khẩu mới cần ít nhất 10 ký tự.").max(1_024),
}).strict().refine((value) => value.currentPassword !== value.newPassword, { path: ["newPassword"], message: "Mật khẩu mới phải khác mật khẩu hiện tại." });

export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;

export class CurrentPasswordMismatchError extends Error {
  constructor() {
    super("Mật khẩu hiện tại không đúng.");
    this.name = "CurrentPasswordMismatchError";
  }
}
