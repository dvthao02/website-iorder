"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearTransientDrafts } from "@/components/admin/ui/transient-draft-store";
import { confirmLeavingUnsavedChanges } from "@/components/admin/ui/use-navigation-guard";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (submitting.current || !confirmLeavingUnsavedChanges()) return;
    submitting.current = true;
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Không thể đăng xuất lúc này. Vui lòng thử lại.");
      clearTransientDrafts();
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("Không thể đăng xuất lúc này. Vui lòng thử lại.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-2"><button
      className="rounded-lg border border-[var(--cms-border)] bg-[var(--cms-card)] px-4 py-2 text-sm font-bold text-[var(--cms-text)] transition hover:bg-[var(--cms-hover)] disabled:cursor-wait disabled:opacity-70"
      disabled={isSubmitting}
      onClick={signOut}
      type="button"
    >
      {isSubmitting ? "Đang thoát…" : "Đăng xuất"}
    </button>{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}</div>
  );
}
