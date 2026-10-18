import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { getRequestAdministrator } from "@/lib/backend";

// Màn của chính người đang đăng nhập: ai cũng vào được, không cần quyền "Người dùng CMS".
export default async function MyAccountPage() {
  const administrator = await getRequestAdministrator();
  if (!administrator) redirect("/admin/login");

  return <main className="admin-settings-page">
    <h1 className="sr-only">Tài khoản của tôi</h1>
    <section className="admin-settings-page__section" aria-labelledby="my-account-info">
      <header><h2 id="my-account-info">Thông tin tài khoản</h2><p>Họ tên, tên đăng nhập và vai trò do quản trị viên quản lý ở mục Người dùng CMS.</p></header>
      <dl className="admin-description-list">
        <div><dt>Họ và tên</dt><dd>{administrator.fullName}</dd></div>
        <div><dt>Tên đăng nhập</dt><dd>{administrator.username}</dd></div>
        <div><dt>Vai trò</dt><dd>{administrator.roleName ?? administrator.role}</dd></div>
      </dl>
    </section>
    <section className="admin-settings-page__section" aria-labelledby="my-account-password">
      <header><h2 id="my-account-password">Đổi mật khẩu</h2><p>Sau khi đổi, các phiên đăng nhập ở thiết bị khác sẽ bị đăng xuất; phiên hiện tại giữ nguyên.</p></header>
      <ChangePasswordForm />
    </section>
  </main>;
}
