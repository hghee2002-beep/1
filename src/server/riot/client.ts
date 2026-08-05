import "server-only";

import { RiotApiError } from "@/features/riot/errors";
import { MockRiotClient } from "@/features/riot/mock-client";
import type { RiotClient } from "@/features/riot/types";
import { serverEnv } from "@/lib/env/server";
import { RealRiotClient } from "@/server/riot/real-client";

let singleton: RiotClient | undefined;

export function getRiotClient(): RiotClient {
  if (singleton) return singleton;
  if (serverEnv.MOCK_RIOT_API) {
    singleton = new MockRiotClient();
    return singleton;
  }
  if (!serverEnv.RIOT_API_KEY) {
    throw new RiotApiError(
      "RIOT_CONFIGURATION_ERROR",
      "실 Riot API 모드에는 서버 자격 증명이 필요합니다.",
    );
  }
  singleton = new RealRiotClient({
    apiKey: serverEnv.RIOT_API_KEY,
    platformRegion: serverEnv.RIOT_PLATFORM_REGION,
    regionalRoute: serverEnv.RIOT_REGIONAL_ROUTE,
  });
  return singleton;
}
