import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/features/auth/redirect";
import { getCurrentAuthSession } from "@/server/auth/current-session";

export const metadata: Metadata = { title: "로그인" };

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, query] = await Promise.all([
    getCurrentAuthSession(),
    searchParams,
  ]);
  const redirectParam = Array.isArray(query.redirect)
    ? query.redirect[0]
    : query.redirect;
  const redirectTo = safeRedirectPath(redirectParam, "/me");
  if (session) redirect(redirectTo);

  return (
    <AuthFrame
      eyebrow="ACCOUNT ACCESS"
      title="로그인"
      description="대회 참가 신청과 내 기록을 확인합니다."
      alternate={{ text: "계정이 없나요?", label: "회원가입", href: "/signup" }}
    >
      <LoginForm
        redirectTo={redirectTo}
        registered={query.registered === "1"}
        loggedOut={query.loggedOut === "1"}
        passwordChanged={query.passwordChanged === "1"}
      />
    </AuthFrame>
  );
}
