import { redirect } from "next/navigation";

import { cmsPermissions, cmsRoles } from "@iorder/core/server/auth/permissions";
import { getRequestAdministrator } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function RolesAndPermissionsPage() {
  const actor = await getRequestAdministrator();
  if (actor?.role !== "admin") redirect("/admin");

  const labels = new Map(cmsPermissions.map((permission) => [permission.code, permission]));

  return <main className="mx-auto grid max-w-7xl gap-6 p-5 md:p-8">
    <header>
      <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Quản trị hệ thống</p>
      <h1 className="mt-1 text-2xl font-extrabold text-[var(--cms-text)]">Vai trò & quyền</h1>
      <p className="mt-2 max-w-3xl text-[var(--cms-muted)]">Các role chuẩn được đồng bộ khi khởi tạo CMS. Gán một role cho mỗi tài khoản tại mục Người dùng CMS; quyền luôn được kiểm tra ở Backend trước khi API xử lý.</p>
    </header>
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Ma trận vai trò và quyền">
      {cmsRoles.map((role) => <article className="rounded-2xl border border-[var(--cms-border)] bg-[var(--cms-card)] p-5 shadow-sm" key={role.code}>
        <h2 className="text-lg font-extrabold text-[var(--cms-text)]">{role.name}</h2>
        <p className="mt-1 font-mono text-xs text-[var(--cms-muted)]">{role.code}</p>
        <ul className="mt-4 grid gap-2" aria-label={`Quyền của ${role.name}`}>
          {role.permissions.map((code) => {
            const permission = labels.get(code);
            return <li className="rounded-lg bg-[var(--cms-hover)] px-3 py-2" key={code}><strong className="block text-sm text-[var(--cms-text)]">{permission?.name ?? code}</strong><span className="block text-xs text-[var(--cms-muted)]">{permission?.description}</span></li>;
          })}
        </ul>
      </article>)}
    </section>
  </main>;
}
