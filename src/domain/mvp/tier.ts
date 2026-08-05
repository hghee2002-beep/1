import type { MvpTierBucket } from "@/domain/mvp/contract";

export function resolveMvpTierBucket(
  tier: string | null | undefined,
): MvpTierBucket | null {
  switch (tier?.trim().toUpperCase()) {
    case "PLATINUM":
      return "PLATINUM";
    case "EMERALD":
      return "EMERALD";
    case "DIAMOND":
      return "DIAMOND";
    case "MASTER":
    case "GRANDMASTER":
    case "CHALLENGER":
      return "MASTER_PLUS";
    default:
      return null;
  }
}
