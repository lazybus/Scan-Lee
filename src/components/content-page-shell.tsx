import type { ReactNode } from "react";

type ContentPageShellProps = {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
};

export function ContentPageShell({ eyebrow, title, lead, children }: ContentPageShellProps) {
  return (
    <section className="content-page-shell">
      <header className="content-page-header">
        <p className="content-page-eyebrow data-label">{eyebrow}</p>
        <h1 className="content-page-title">{title}</h1>
        <p className="content-page-lead">{lead}</p>
      </header>

      <div className="content-page-body">{children}</div>
    </section>
  );
}