import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return <main className="admin-message">
    <section>
      <ShieldAlert aria-hidden="true" className="admin-text-warning" size={22} />
      <div className="grid gap-1">
        <p className="admin-field__hint">Không có quyền truy cập</p>
        <h1>Tài khoản của bạn chưa được cấp quyền xem khu vực này.</h1>
        <p className="admin-help">Nếu bạn cần dùng chức năng này, hãy liên hệ quản trị viên để được cấp thêm quyền trong mục Vai trò & quyền.</p>
      </div>
      <Link className="admin-button admin-button--primary w-fit" href="/admin">Về trang tổng quan</Link>
    </section>
  </main>;
}
