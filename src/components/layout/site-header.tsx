"use client";

import {
  ChevronDown,
  CircleUserRound,
  History,
  Home,
  Menu,
  ScrollText,
  Shield,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutForm } from "@/components/auth/logout-form";
import type { SeasonContext, WeekContext } from "@/server/dashboard/types";

const navigation = [
  { href: "/", label: "홈", icon: Home },
  { href: "/leaderboard", label: "순위표", icon: Trophy },
  { href: "/matches", label: "경기 기록", icon: Swords },
  { href: "/missions", label: "주간 미션", icon: Target },
  { href: "/history", label: "지난 주차", icon: History },
  { href: "/rules", label: "대회 규칙", icon: ScrollText },
] as const;

export function SiteHeader({
  viewer,
  event,
}: {
  viewer: { displayName: string; role: "USER" | "ADMIN" } | null;
  event: {
    season: SeasonContext;
    week: WeekContext;
    freshness: { lastSuccessAt: string | null; stale: boolean };
  } | null;
}) {
  const pathname = usePathname();

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="디럭스 솔랭 홈">
            <span className="brand-signal" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>
              <strong>DELUXE</strong>
              <small>SOLO QUEUE</small>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="주 메뉴">
            {navigation.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  className={active ? "is-active" : undefined}
                  href={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="header-tools">
            <details className="menu-popover season-menu">
              <summary>
                <span className="live-dot" aria-hidden="true" />
                {event
                  ? `${event.season.name} · ${event.week.name}`
                  : "대회 정보 없음"}
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="popover-panel">
                <strong>
                  {event?.season.eventName ?? "진행 중인 대회가 없습니다."}
                </strong>
                {event ? (
                  <span>
                    {new Date(event.season.startAt).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}{" "}
                    —{" "}
                    {new Date(event.season.endAt).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </span>
                ) : null}
                <button type="button" disabled>
                  시즌 변경
                </button>
              </div>
            </details>
            <details className="menu-popover account-menu">
              <summary aria-label="계정 메뉴">
                <CircleUserRound aria-hidden="true" />
                <span>{viewer?.displayName ?? "계정"}</span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="popover-panel popover-links">
                {viewer ? (
                  <>
                    <Link href="/me">내 정보</Link>
                    <Link href="/apply">참가 신청</Link>
                    {viewer.role === "ADMIN" ? (
                      <Link href="/admin">
                        <Shield aria-hidden="true" />
                        관리자
                      </Link>
                    ) : null}
                    <LogoutForm />
                  </>
                ) : (
                  <>
                    <Link href="/login">로그인</Link>
                    <Link href="/signup">회원가입</Link>
                  </>
                )}
              </div>
            </details>
            <details className="menu-popover mobile-menu">
              <summary aria-label="전체 메뉴">
                <Menu aria-hidden="true" />
              </summary>
              <nav
                className="popover-panel popover-links"
                aria-label="모바일 전체 메뉴"
              >
                {navigation.map((item) => (
                  <Link key={item.href} href={item.href}>
                    {item.label}
                  </Link>
                ))}
                {viewer?.role === "ADMIN" ? (
                  <Link href="/admin">관리자</Link>
                ) : null}
                {viewer ? (
                  <>
                    <Link href="/me">내 정보</Link>
                    <LogoutForm />
                  </>
                ) : (
                  <Link href="/login">로그인</Link>
                )}
              </nav>
            </details>
          </div>
        </div>
        <div className="freshness-bar">
          <span>
            <span className="live-dot" aria-hidden="true" />
            {event?.freshness.stale ? "STALE DATA" : "LIVE DATA"}
          </span>
          <span>
            마지막 동기화{" "}
            {event?.freshness.lastSuccessAt
              ? new Date(event.freshness.lastSuccessAt).toLocaleString(
                  "ko-KR",
                  { timeZone: "Asia/Seoul" },
                )
              : "기록 없음"}
          </span>
          <span className="freshness-next">Asia/Seoul</span>
        </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="모바일 빠른 메뉴">
        {navigation.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              className={active ? "is-active" : undefined}
              href={item.href}
            >
              <Icon aria-hidden="true" />
              <span>{item.label.replace("주간 ", "")}</span>
            </Link>
          );
        })}
        <Link
          className={
            pathname.startsWith("/me") || pathname.startsWith("/login")
              ? "is-active"
              : undefined
          }
          href={viewer ? "/me" : "/login"}
        >
          <CircleUserRound aria-hidden="true" />
          <span>{viewer ? "내 정보" : "로그인"}</span>
        </Link>
      </nav>
    </>
  );
}
