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
    if (submitting.current || !(await confirmLeavingUnsavedChanges())) return;
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
      disabled={isSubmitting}
      onClick={signOut}
      type="button"
    >
      {isSubmitting ? "Đang thoát…" : "Đăng xuất"}
    </button>{error ? <p role="alert" className="text-sm admin-text-error">{error}</p> : null}</div>
  );
}
