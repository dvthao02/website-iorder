import type { ReactNode } from "react";

type AdminListHeaderProps = {
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  headingLevel?: 1 | 2;
  title: string;
};

export function AdminListHeader({ actions, description, eyebrow, headingLevel = 2, title }: AdminListHeaderProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return <header className="admin-list-header">
    <div className="min-w-0">
      {eyebrow ? <p className="admin-list-header__eyebrow">{eyebrow}</p> : null}
      <Heading>{title}</Heading>
      <p className="admin-list-header__description">{description}</p>
    </div>
    {actions ? <div className="admin-list-header__actions">{actions}</div> : null}
  </header>;
}
