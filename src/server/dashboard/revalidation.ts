import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

export function revalidatePublicDashboard(participantId?: string) {
  revalidateTag("public-dashboard", "max");
  revalidatePath("/");
  revalidatePath("/leaderboard");
  revalidatePath("/matches");
  revalidatePath("/missions");
  revalidatePath("/history");
  revalidatePath("/rules");
  revalidatePath("/me");
  if (participantId) revalidatePath(`/participants/${participantId}`);
}
