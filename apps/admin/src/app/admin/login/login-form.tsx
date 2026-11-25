"use client";

import { apiErrorMessage } from "@/lib/admin-api";
import { loginFailureEvent, loginSuccessEvent, type LoginSuccessDetail } from "@/lib/login-events";
import type { LoginTheme } from "@/lib/login-theme";
import { LoaderCircle, Snowflake } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { useAdminToast } from "@/components/admin/ui/admin-feedback";
import { AdminPasswordInput } from "@/components/admin/ui/admin-password-input";

type LoginFormProps = {
  initialError?: string;
  /** Giao diện đăng nhập đang hiện: quyết định hình vòng xoay trên nút (mặc định vòng tròn; Giáng sinh là bông tuyết). */
  theme?: LoginTheme;
};

// Vòng xoay trên nút đăng nhập, theo giao diện: đứng yên suốt lúc chờ Backend trả lời và lúc chờ mở CMS cho tới khi trang chuyển.
function LoginSpinner({ theme }: { theme: LoginTheme }) {
  return theme === "christmas"
    ? <Snowflake aria-hidden="true" className="login-spinner login-spinner--christmas" size={16} />
    : <LoaderCircle aria-hidden="true" className="login-spinner" size={16} />;
}

// Thông báo nổi (AdminToastProvider) do trang đăng nhập đặt NGOÀI thẻ: thẻ Giáng sinh nghiêng 3D và rung bằng transform, mà phần tử fixed nằm trong
// một tổ tiên có transform thì định vị theo tổ tiên đó chứ không theo màn hình, nên thông báo bị lệch ra ngoài mép phải và rung theo thẻ.

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

export function LoginForm({ initialError, theme = "default" }: LoginFormProps) {
  const toast = useAdminToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Đã đăng nhập đúng, đang chờ trang CMS mở (có thể vài giây vì CMS dựng ở server): nút nói rõ điều đó thay vì quay mãi một chữ "Đang đăng nhập".
  const [isOpening, setIsOpening] = useState(false);

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

    // Giao diện theo mùa có thể xin thêm một nhịp (delayMs) để chiếu hiệu ứng chúc mừng; nút giữ vòng xoay đến lúc chuyển trang.
    setIsOpening(true);
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
        aria-busy={isSubmitting}
        className="admin-button admin-button--primary w-full"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? <LoginSpinner theme={theme} /> : null}
        {isOpening ? "Đăng nhập thành công, đang mở CMS…" : isSubmitting ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
      <p className="admin-help text-center">Quên mật khẩu? Nhờ quản trị viên đặt lại trong mục Người dùng CMS.</p>
    </form>
  );
}
