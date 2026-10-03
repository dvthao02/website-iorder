"use client";

import { FormEvent, useState } from "react";

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
      const message = payload?.error?.message;
      setError(typeof message === "string" ? message : "Không thể đăng nhập. Vui lòng thử lại.");
      return;
    }

    window.location.replace("/admin");
  }

  return (
    <form action="/api/admin/session" className="grid gap-5" method="post" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Tên đăng nhập
        <input
          autoComplete="username"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          name="username"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Mật khẩu
        <input
          autoComplete="current-password"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          name="password"
          required
          type="password"
        />
      </label>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <button
        className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-70"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
