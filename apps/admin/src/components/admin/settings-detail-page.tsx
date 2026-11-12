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
  return <main className={className ? `admin-settings-page ${className}` : "admin-settings-page"}>
    <h1 className="sr-only">{title}</h1>
    <p className="admin-help">{description}</p>
    <section className="admin-settings-page__section">{children}</section>
  </main>;
}
