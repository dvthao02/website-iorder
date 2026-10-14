import type { ReactNode } from "react";

type SettingsDetailPageProps = {
  className?: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function SettingsDetailPage({ className, eyebrow, title, description, children }: SettingsDetailPageProps) {
  return <main className={className ? `admin-settings-page ${className}` : "admin-settings-page"}>
    <header className="admin-settings-page__header">
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </header>
    <section className="admin-settings-page__section">{children}</section>
  </main>;
}
