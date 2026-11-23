import Link from "next/link";
import { SearchX } from "lucide-react";

import { AdminMessagePage } from "@/components/admin/ui/admin-message-page";

export default function AdminNotFound() {
  return <AdminMessagePage
    action={<Link className="admin-button admin-button--primary w-fit" href="/admin">Về trang tổng quan</Link>}
    description="Đường dẫn có thể đã cũ. Quay lại danh sách để mở lại nội dung, hoặc dùng ô tìm kiếm ở đầu trang."
    eyebrow="Không tìm thấy"
    icon={<SearchX aria-hidden="true" className="admin-text-muted" size={22} />}
    title="Nội dung này không tồn tại hoặc đã bị xóa."
  />;
}
