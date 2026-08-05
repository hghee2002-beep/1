import type { ReactNode } from "react";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { PublicAutoRefresh } from "@/components/system/public-auto-refresh";
import { publicEnv } from "@/lib/env/public";
import { getCurrentAuthSession } from "@/server/auth/current-session";
import { getSiteContext } from "@/server/dashboard/read";

export async function SiteShell({ children }: { children: ReactNode }) {
  const [session, event] = await Promise.all([
    getCurrentAuthSession(),
    getSiteContext(),
  ]);
  return (
    <>
      <PublicAutoRefresh intervalMs={publicEnv.NEXT_PUBLIC_POLL_INTERVAL_MS} />
      <SiteHeader
        viewer={
          session
            ? {
                displayName: session.user.displayName,
                role: session.user.role,
              }
            : null
        }
        event={event}
      />
      <main id="main-content" className="page-container">
        {children}
      </main>
      <footer className="site-footer">
        <div>
          <strong>DELUXE SOLO QUEUE</strong>
          <p>
            디럭스 솔랭은 Riot Games 또는 LoL Esports의 공식 서비스·공식 대회가
            아닙니다.
          </p>
        </div>
        <nav aria-label="푸터 메뉴">
          <Link href="/rules">대회 규칙</Link>
          <Link href="/rules#terms">이용약관</Link>
          <Link href="/rules#privacy">개인정보</Link>
          <Link href="/rules#notice">비공식 제품 고지</Link>
        </nav>
        <span>SERVER READ MODEL · KST</span>
      </footer>
    </>
  );
}
