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
          경기 기록은 자동으로.
          <br />
          경쟁은 선명하게.
        </h1>
        <p>
          Riot API 기반 솔로 랭크 대회 기록과 점수·미션을 하나의 운영 흐름에서
          확인합니다.
        </p>
        <ol>
          <li>
            <span>01</span>Riot ID는 승인 후 PUUID로 추적
          </li>
          <li>
            <span>02</span>점수 변화는 append-only 원장에 기록
          </li>
          <li>
            <span>03</span>미션은 경기 시작 시점 기준으로 판정
          </li>
        </ol>
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
