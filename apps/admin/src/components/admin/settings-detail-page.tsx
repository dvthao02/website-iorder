import { AdminPage } from "@/components/admin/ui/admin-page";
import { AdminPageBarHelp } from "@/components/admin/ui/admin-page-bar";
import type { ReactNode } from "react";

type SettingsDetailPageProps = {
  className?: string;
  /** Không còn hiển thị: thanh vị trí của khung CMS đã cho biết nhóm. */
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function SettingsDetailPage({ className, title, description, children }: SettingsDetailPageProps) {
  return <AdminPage className={className}>
    <h1 className="sr-only">{title}</h1>
    <AdminPageBarHelp>{description}</AdminPageBarHelp>
    <section className="admin-settings-page__section">{children}</section>
  </AdminPage>;
}
