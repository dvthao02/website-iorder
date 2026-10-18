import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập quản trị | iOrder",
  robots: { index: false, follow: false },
};

const thongBaoLoiDangNhap: Record<string, string> = {
  INVALID_CREDENTIALS: "Thông tin đăng nhập quản trị không chính xác.",
  INVALID_INPUT: "Vui lòng nhập tên đăng nhập và mật khẩu hợp lệ.",
  RATE_LIMITED: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.",
  INTERNAL_ERROR: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
};

export default async function AdministratorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="w-full max-w-sm rounded-[var(--cms-radius-card)] border border-[var(--cms-border)] bg-[var(--cms-card)] p-6">
        <p className="mb-1 text-[13px] text-[var(--cms-muted)]">iOrder CMS</p>
        <h1 className="mb-1">Đăng nhập</h1>
        <p className="mb-5 text-[13px] text-[var(--cms-muted)]">Dùng tài khoản quản trị đã được khởi tạo trong database.</p>
        <LoginForm initialError={error ? thongBaoLoiDangNhap[error] : undefined} />
      </section>
    </main>
  );
}
