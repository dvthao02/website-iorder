import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { AdminMessagePage } from "@/components/admin/ui/admin-message-page";

export default function ForbiddenPage() {
  return <AdminMessagePage
    action={<Link className="admin-button admin-button--primary w-fit" href="/admin">Về trang tổng quan</Link>}
    description="Nếu bạn cần dùng chức năng này, hãy liên hệ quản trị viên để được cấp thêm quyền trong mục Vai trò & quyền."
    eyebrow="Không có quyền truy cập"
    icon={<ShieldAlert aria-hidden="true" className="admin-text-warning" size={22} />}
    title="Tài khoản của bạn chưa được cấp quyền xem khu vực này."
  />;
}
