import { parsePublicEnv } from "@/lib/env/schema";

export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_POLL_INTERVAL_MS: process.env.NEXT_PUBLIC_POLL_INTERVAL_MS,
});
