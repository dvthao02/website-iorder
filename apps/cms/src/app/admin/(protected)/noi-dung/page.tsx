import { CmsContentManager } from "@/components/admin/cms-content-manager";
import { getAdminOfferings } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function AdministratorContentPage() {
  const offerings = await getAdminOfferings();

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <section className="mx-auto max-w-7xl">
        <header className="mb-8 max-w-3xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">iOrder CMS</p>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-950">Nội dung sản phẩm</h1>
          <p className="leading-7 text-slate-600">Mỗi lần lưu nội dung catalog tạo phiên bản và nhật ký thay đổi. Tài nguyên tải xuống được quản lý riêng tại mục Tài nguyên.</p>
        </header>
        <CmsContentManager initialOfferings={offerings} />
      </section>
    </main>
  );
}
