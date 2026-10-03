"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signOut() {
    setIsSubmitting(true);
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
      disabled={isSubmitting}
      onClick={signOut}
      type="button"
    >
      {isSubmitting ? "Đang thoát…" : "Đăng xuất"}
    </button>
  );
}
