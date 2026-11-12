import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { administratorSessionCookieName, getCurrentAdministrator } from "@/lib/backend";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminNotifications } from "@/lib/backend";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProtectedAdministratorLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const administrator = await getCurrentAdministrator(cookieStore.get(administratorSessionCookieName)?.value);

  if (!administrator) {
    redirect("/admin/login");
  }

  const notifications = await getAdminNotifications();

  return <AdminShell administrator={administrator} notifications={notifications}>{children}</AdminShell>;
}
