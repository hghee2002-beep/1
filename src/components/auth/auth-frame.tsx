import type { ReactNode } from "react";
import Link from "next/link";

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
  alternate,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  alternate: { text: string; label: string; href: string };
}) {
  return (
    <div className="auth-layout">
      <section className="auth-context">
        <p className="section-label">DELUXE SOLO QUEUE</p>
        <h1>디럭스 솔랭내기</h1>
        <p>2026 썸머시즌</p>
      </section>
      <section className="auth-panel">
        <p className="section-label">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p className="auth-description">{description}</p> : null}
        {children}
        <p className="auth-alternate">
          {alternate.text} <Link href={alternate.href}>{alternate.label}</Link>
        </p>
      </section>
    </div>
  );
}
