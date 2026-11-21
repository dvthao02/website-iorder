import Link from "next/link";

// Địa chỉ ngoài /admin (ví dụ gõ nhầm): trang 404 tiếng Việt thay cho trang mặc định của Next.
export default function NotFound() {
  return <main className="grid min-h-screen place-items-center p-4">
    <section className="grid w-full max-w-sm gap-3 rounded-[var(--cms-radius-card)] border border-[var(--cms-border)] bg-[var(--cms-card)] p-6">
      <p className="text-[13px] text-[var(--cms-muted)]">Không tìm thấy trang</p>
      <h1>Địa chỉ này không có trong CMS.</h1>
      <p className="text-[13px] text-[var(--cms-muted)]">Đường dẫn có thể bị gõ nhầm hoặc đã cũ.</p>
      <Link className="admin-button admin-button--primary w-fit" href="/admin">Về trang tổng quan</Link>
    </section>
  </main>;
}
