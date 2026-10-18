"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function ProtectedAdministratorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="admin-message">
    <section>
      <TriangleAlert aria-hidden="true" className="admin-text-warning" size={22} />
      <div className="grid gap-1">
        <p className="admin-field__hint">Không thể tải khu vực quản trị</p>
        <h1>Dữ liệu CMS đang tạm thời không sẵn sàng.</h1>
        <p className="text-sm leading-6">Hãy thử tải lại. Nếu lỗi tiếp diễn, kiểm tra dịch vụ Backend rồi quay lại CMS.</p>
      </div>
      <button className="admin-button admin-button--primary w-fit" onClick={reset} type="button"><RefreshCw aria-hidden="true" size={16} />Thử lại</button>
    </section>
  </main>;
}
