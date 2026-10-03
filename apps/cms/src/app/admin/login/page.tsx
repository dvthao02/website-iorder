import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập quản trị | iOrder",
  robots: { index: false, follow: false },
};

const thongBaoLoiDangNhap: Record<string, string> = {
  INVALID_CREDENTIALS: "Thông tin đăng nhập quản trị không chính xác.",
  INVALID_INPUT: "Vui lòng nhập tên đăng nhập và mật khẩu hợp lệ.",
  INTERNAL_ERROR: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
};

export default async function AdministratorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/10 sm:p-9">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">iOrder CMS</p>
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900">Đăng nhập</h1>
        <p className="mb-7 leading-6 text-slate-600">Dùng tài khoản quản trị đã được khởi tạo trong database.</p>
        <LoginForm initialError={error ? thongBaoLoiDangNhap[error] : undefined} />
      </section>
    </main>
  );
}
