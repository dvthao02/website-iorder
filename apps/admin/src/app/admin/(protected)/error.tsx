"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminMessagePage } from "@/components/admin/ui/admin-message-page";

export default function ProtectedAdministratorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminMessagePage
    action={<AdminButton className="w-fit" leadingIcon={<RefreshCw aria-hidden="true" size={16} />} onClick={reset}>Thử lại</AdminButton>}
    description="Hãy thử tải lại. Nếu lỗi tiếp diễn, kiểm tra dịch vụ Backend rồi quay lại CMS."
    eyebrow="Không thể tải khu vực quản trị"
    icon={<TriangleAlert aria-hidden="true" className="admin-text-warning" size={22} />}
    title="Dữ liệu CMS đang tạm thời không sẵn sàng."
  />;
}
