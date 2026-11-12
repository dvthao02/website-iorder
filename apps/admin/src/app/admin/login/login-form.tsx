"use client";

import { apiErrorMessage } from "@/lib/admin-api";
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

    setIsSubmitting(false);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => undefined);
      toast.show(apiErrorMessage(payload, "Không thể đăng nhập. Vui lòng thử lại."), "error");
      return;
    }

    window.location.replace("/admin");
  }

  return (
    <form action="/api/v1/admin/session" className="grid gap-4" method="post" onSubmit={handleSubmit}>
      <label className="admin-field">
        Tên đăng nhập
        <input
          autoComplete="username"
          autoFocus
          className="admin-input"
          name="username"
          required
        />
      </label>
      <div className="admin-field">
        <label htmlFor="login-password">Mật khẩu</label>
        <AdminPasswordInput
          autoComplete="current-password"
          id="login-password"
          name="password"
          required
        />
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
