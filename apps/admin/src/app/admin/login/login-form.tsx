"use client";

import { apiErrorMessage } from "@/lib/admin-api";
import { loginFailureEvent, loginSuccessEvent, type LoginSuccessDetail } from "@/lib/login-events";
import { FormEvent, useEffect, useState } from "react";

import { AdminToastProvider, useAdminToast } from "@/components/admin/ui/admin-feedback";
import { AdminPasswordInput } from "@/components/admin/ui/admin-password-input";

type LoginFormProps = {
  initialError?: string;
};

export function LoginForm(props: LoginFormProps) {
  return (
    <AdminToastProvider>
      <LoginFormContent {...props} />
    </AdminToastProvider>
  );
}

// Khung viền "có khuyết" cho nhãn nổi ở theme Giáng sinh (CSS ẩn nó ở giao diện thường). Dùng fieldset/legend để trình duyệt tự
// cắt đường viền đúng bằng chiều rộng chữ, nhờ vậy nhãn không cần nền che viền (nền che luôn lệch màu so với ô). Chữ của legend
// nằm trong data-label (vẽ bằng ::before) nên không thêm văn bản thứ hai vào trang.
function LoginFieldFrame({ label }: { label: string }) {
  return (
    <fieldset aria-hidden="true" className="admin-field__frame">
      <legend data-label={label} />
    </fieldset>
  );
}

function LoginFormContent({ initialError }: LoginFormProps) {
  const toast = useAdminToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialError) toast.show(initialError, "error");
    // Chỉ hiện một lần khi trang mở với tham số lỗi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Chặn gửi trùng (ví dụ nhấn Enter lần nữa trong lúc giao diện theo mùa đang chiếu hiệu ứng chúc mừng).
    if (isSubmitting) return;
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    }).catch(() => undefined);

    if (!response?.ok) {
      setIsSubmitting(false);
      const payload = await response?.json().catch(() => undefined);
      toast.show(apiErrorMessage(payload, "Không thể đăng nhập. Vui lòng thử lại."), "error");
      window.dispatchEvent(new CustomEvent(loginFailureEvent));
      return;
    }

    // Giao diện theo mùa có thể xin thêm một nhịp (delayMs) để chiếu hiệu ứng chúc mừng; nút giữ trạng thái "đang đăng nhập" đến lúc chuyển trang.
    const celebration: LoginSuccessDetail = { delayMs: 0 };
    window.dispatchEvent(new CustomEvent<LoginSuccessDetail>(loginSuccessEvent, { detail: celebration }));
    if (celebration.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, celebration.delayMs));
    window.location.replace("/admin");
  }

  return (
    <form action="/api/v1/admin/session" className="grid gap-4" method="post" onSubmit={handleSubmit}>
      <div className="admin-field">
        <label className="admin-field__label" htmlFor="login-username">Tên đăng nhập</label>
        <input
          autoComplete="username"
          autoFocus
          className="admin-input"
          id="login-username"
          name="username"
          placeholder=" "
          required
        />
        <LoginFieldFrame label="Tên đăng nhập" />
      </div>
      <div className="admin-field">
        <label className="admin-field__label" htmlFor="login-password">Mật khẩu</label>
        <AdminPasswordInput
          autoComplete="current-password"
          id="login-password"
          name="password"
          placeholder=" "
          required
        />
        <LoginFieldFrame label="Mật khẩu" />
      </div>
      <button
        className="admin-button admin-button--primary w-full"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
      <p className="admin-help text-center">Quên mật khẩu? Nhờ quản trị viên đặt lại trong mục Người dùng CMS.</p>
    </form>
  );
}
