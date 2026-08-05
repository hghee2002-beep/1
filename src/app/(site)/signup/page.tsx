import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/auth/auth-frame";
import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentAuthSession } from "@/server/auth/current-session";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignupPage() {
  const session = await getCurrentAuthSession();
  if (session) redirect("/me");

  return (
    <AuthFrame
      eyebrow="CREATE ACCOUNT"
      title="회원가입"
      description="사이트 계정과 Riot 계정 연결은 별도 단계입니다."
      alternate={{
        text: "이미 계정이 있나요?",
        label: "로그인",
        href: "/login",
      }}
    >
      <SignupForm />
    </AuthFrame>
  );
}
