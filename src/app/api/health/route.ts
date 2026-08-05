import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "deluxe-soloq",
      checkedAt: new Date().toISOString(),
      mode: {
        riot: serverEnv.MOCK_RIOT_API ? "mock" : "live",
        sync: serverEnv.SYNC_MODE,
      },
      config: {
        timeZone: serverEnv.APP_TIME_ZONE,
        pollIntervalMs: publicEnv.NEXT_PUBLIC_POLL_INTERVAL_MS,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
