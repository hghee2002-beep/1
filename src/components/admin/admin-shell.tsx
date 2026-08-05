"use client";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpenText,
  CalendarRange,
  Database,
  FileClock,
  Gauge,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const sections = [
  { slug: "", label: "대시보드", icon: LayoutDashboard },
  { slug: "users", label: "사용자", icon: Users },
  { slug: "applications", label: "참가 신청", icon: FileClock },
  { slug: "participants", label: "참가자", icon: ShieldCheck },
  { slug: "seasons", label: "시즌 · 주차", icon: CalendarRange },
  { slug: "scoring", label: "점수 규칙", icon: BarChart3 },
  { slug: "matches", label: "경기 · 동기화", icon: Swords },
  { slug: "draws", label: "포인트 추첨", icon: Sparkles },
  { slug: "missions", label: "미션", icon: Target },
  { slug: "mvp-baselines", label: "MVP/ACE 기준", icon: Gauge },
  { slug: "content", label: "공지 · 법적 문서", icon: BookOpenText },
  { slug: "audit-exports", label: "감사 · 내보내기", icon: Database },
  { slug: "system", label: "시스템", icon: Workflow },
] as const;

export function AdminShell({
  children,
  currentAdmin,
  runtimeLabel,
}: {
  children: ReactNode;
  currentAdmin: string;
  runtimeLabel: string;
}) {
  const pathname = usePathname();
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link className="brand admin-brand" href="/admin">
          <span className="brand-signal" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>DELUXE</strong>
            <small>OPERATIONS</small>
          </span>
        </Link>
        <div className="admin-mode">
          <Activity aria-hidden="true" />
          <span>
            <strong>{runtimeLabel}</strong>서버 검증 활성
          </span>
        </div>
        <nav aria-label="관리자 메뉴">
          {sections.map((section) => {
            const href = `/admin${section.slug ? `/${section.slug}` : ""}`;
            const active = pathname === href;
            const Icon = section.icon;
            return (
              <Link
                key={section.slug}
                className={active ? "is-active" : undefined}
                href={href}
              >
                <Icon aria-hidden="true" />
                {section.label}
              </Link>
            );
          })}
        </nav>
        <Link className="admin-exit" href="/">
          <ArrowLeft aria-hidden="true" />
          공개 사이트로
        </Link>
      </aside>
      <div className="admin-surface">
        <header className="admin-topbar">
          <span>
            관리자 /{" "}
            <strong>{pathname.split("/").at(-1) || "dashboard"}</strong>
          </span>
          <span>
            {currentAdmin} · {runtimeLabel}
          </span>
        </header>
        <main id="main-content" className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
