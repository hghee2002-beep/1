import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { serverEnv } from "@/lib/env/server";
import { getCurrentAuthSession } from "@/server/auth/current-session";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCurrentAuthSession();
  if (!session) redirect("/login?redirect=%2Fadmin");
  if (session.user.role !== "ADMIN") redirect("/me?error=admin_required");
  return (
    <AdminShell
      currentAdmin={session.user.displayName}
      runtimeLabel={
        serverEnv.MOCK_RIOT_API
          ? `MOCK RIOT · ${serverEnv.SYNC_MODE}`
          : `RIOT API · ${serverEnv.SYNC_MODE}`
      }
    >
      {children}
    </AdminShell>
  );
}
