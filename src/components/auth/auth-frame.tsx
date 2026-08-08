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
  description: string;
  children: ReactNode;
  alternate: { text: string; label: string; href: string };
}) {
  return (
    <div className="auth-layout">
      <section className="auth-context">
        <p className="section-label">DELUXE SOLO QUEUE</p>
        <h1>
          디럭스 솔랭대결
        </h1>
      
      </section>
      <section className="auth-panel">
        <p className="section-label">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="auth-description">{description}</p>
        {children}
        <p className="auth-alternate">
          {alternate.text} <Link href={alternate.href}>{alternate.label}</Link>
        </p>
        <small className="demo-caption">
          비밀번호는 Argon2id 해시로만 저장되며 브라우저 저장소에 인증 토큰을
          남기지 않습니다.
        </small>
      </section>
    </div>
  );
}
