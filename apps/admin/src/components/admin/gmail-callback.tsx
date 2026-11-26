"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { AdminApiError, requestAdminJson } from "../../lib/admin-api";
import { AdminButton } from "./ui/admin-button";
import { AdminNotice } from "./ui/admin-feedback";

// Trang Google chuyển về sau khi bạn cấp (hoặc từ chối) quyền gửi thư: gửi mã sang Backend để đổi lấy token rồi quay về màn Kết nối.

const googleErrors: Record<string, string> = {
  access_denied: "Bạn đã từ chối cấp quyền nên chưa kết nối được Gmail.",
};

export function GmailCallback({ code, state, error }: { code?: string; state?: string; error?: string }) {
  const router = useRouter();
  const started = useRef(false);
  const invalid = Boolean(error) || !code || !state;
  const [failure, setFailure] = useState<string | null>(error ? googleErrors[error] ?? "Google không hoàn tất việc cấp quyền. Thử kết nối lại." : !code || !state ? "Liên kết không hợp lệ. Bấm Kết nối Gmail để thử lại." : null);

  useEffect(() => {
    // Strict Mode chạy effect hai lần ở bản dev: mã cấp quyền chỉ dùng được một lần.
    if (started.current || invalid) return;
    started.current = true;
    requestAdminJson("/api/v1/admin/gmail", "POST", { action: "finish", code, state }, "Không hoàn tất được kết nối Gmail.", { cache: "no-store" })
      .then(() => router.replace("/admin/integrations/gmail?gmail=connected"))
      .catch((requestError: unknown) => setFailure(requestError instanceof AdminApiError ? requestError.message : "Không kết nối được máy chủ. Thử lại sau."));
  }, [code, invalid, router, state]);

  if (failure) return <div className="admin-status-stack">
    <AdminNotice tone="error">{failure}</AdminNotice>
    <div><AdminButton href="/admin/integrations/gmail" variant="primary">Quay lại Gmail báo liên hệ</AdminButton></div>
  </div>;
  return <p aria-busy="true" className="admin-dashboard__empty">Đang hoàn tất kết nối Gmail…</p>;
}
