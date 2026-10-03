"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function ProtectedAdministratorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[52vh] place-items-center p-5 md:p-8">
    <section className="grid max-w-lg gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-slate-800 shadow-sm">
      <TriangleAlert aria-hidden="true" className="text-amber-700" size={30} />
      <div className="grid gap-2">
        <p className="text-sm font-extrabold uppercase tracking-wide text-amber-800">Không thể tải khu vực quản trị</p>
        <h1 className="text-2xl font-extrabold text-slate-950">Dữ liệu CMS đang tạm thời không sẵn sàng.</h1>
        <p className="text-sm leading-6 text-slate-700">Hãy thử tải lại. Nếu lỗi tiếp diễn, kiểm tra dịch vụ Backend rồi quay lại CMS.</p>
      </div>
      <button className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800" onClick={reset} type="button"><RefreshCw aria-hidden="true" size={16} />Thử lại</button>
    </section>
  </main>;
}
