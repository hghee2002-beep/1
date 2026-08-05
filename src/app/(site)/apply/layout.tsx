import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentAuthSession } from "@/server/auth/current-session";

export default async function ApplyLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCurrentAuthSession();
  if (!session) redirect("/login?redirect=%2Fapply");
  return children;
}
