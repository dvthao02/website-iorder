"use client";

import { apiErrorMessage } from "@/lib/admin-api";
import { FormEvent, useState } from "react";

import { AdminPasswordInput } from "@/components/admin/ui/admin-password-input";

type LoginFormProps = {
  initialError?: string;
};

export function LoginForm({ initialError }: LoginFormProps) {
  const [error, setError] = useState<string | undefined>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/session", {
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
      setError(apiErrorMessage(payload, "Không thể đăng nhập. Vui lòng thử lại."));
      return;
    }

    window.location.replace("/admin");
  }

  return (
    <form action="/api/admin/session" className="grid gap-4" method="post" onSubmit={handleSubmit}>
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
      {error ? <p className="admin-help admin-text-error">{error}</p> : null}
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
