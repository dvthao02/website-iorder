import Link from "next/link";
import { SearchX } from "lucide-react";

export default function AdminNotFound() {
  return <main className="admin-message">
    <section>
      <SearchX aria-hidden="true" className="admin-text-muted" size={22} />
      <div className="grid gap-1">
        <p className="admin-field__hint">Không tìm thấy</p>
        <h1>Nội dung này không tồn tại hoặc đã bị xóa.</h1>
        <p className="admin-help">Đường dẫn có thể đã cũ. Quay lại danh sách để mở lại nội dung, hoặc dùng ô tìm kiếm ở đầu trang.</p>
      </div>
      <Link className="admin-button admin-button--primary w-fit" href="/admin">Về trang tổng quan</Link>
    </section>
  </main>;
}
