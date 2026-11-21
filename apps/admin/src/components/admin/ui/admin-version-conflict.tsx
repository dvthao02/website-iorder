"use client";

import { RefreshCw, TriangleAlert, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { versionConflictEvent } from "@/lib/admin-api";

import { AdminButton } from "./admin-button";

// Khi lưu bị từ chối vì người khác vừa cập nhật cùng nội dung (409), hiện một thanh cố định để người dùng
// tải bản mới nhất, hoặc mở bản mới ở tab khác để chép lại phần mình đang sửa trước khi tải lại.
export function AdminVersionConflictBanner() {
  const pathname = usePathname();
  const [conflictPath, setConflictPath] = useState<string | null>(null);

  useEffect(() => {
    const onConflict = () => setConflictPath(window.location.pathname);
    window.addEventListener(versionConflictEvent, onConflict);
    return () => window.removeEventListener(versionConflictEvent, onConflict);
  }, []);

  // Chuyển sang màn khác thì thông báo của màn cũ không còn ý nghĩa.
  if (conflictPath !== pathname) return null;
  return <div className="admin-conflict-banner" role="alert">
    <TriangleAlert aria-hidden="true" size={18} />
    <p><strong>Nội dung vừa được người khác cập nhật.</strong> Thay đổi của bạn chưa được lưu. Tải bản mới nhất để tiếp tục, hoặc mở bản mới ở tab khác để chép lại phần đang sửa.</p>
    <div>
      <AdminButton onClick={() => window.open(window.location.href, "_blank", "noopener")} size="sm" variant="secondary">Mở bản mới ở tab khác</AdminButton>
      <AdminButton leadingIcon={<RefreshCw aria-hidden="true" />} onClick={() => window.location.reload()} size="sm">Tải bản mới nhất</AdminButton>
      <button aria-label="Đóng thông báo" className="admin-content-actions__button" onClick={() => setConflictPath(null)} type="button"><X aria-hidden="true" /></button>
    </div>
  </div>;
}
