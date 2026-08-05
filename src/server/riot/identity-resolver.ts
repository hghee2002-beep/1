import "server-only";

import type { RiotIdentityResolver } from "@/features/riot/identity";
import { getRiotClient } from "@/server/riot/client";

const resolver: RiotIdentityResolver = {
  resolve(identity) {
    return getRiotClient().resolveRiotId(identity.gameName, identity.tagLine);
  },
};

export function getRiotIdentityResolver(): RiotIdentityResolver {
  return resolver;
}
