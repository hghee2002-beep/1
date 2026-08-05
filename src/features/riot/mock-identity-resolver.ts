import { type RiotIdentityResolver } from "@/features/riot/identity";
import {
  MockRiotClient,
  mockRiotIdentityFixtures,
} from "@/features/riot/mock-client";

export class MockRiotIdentityResolver implements RiotIdentityResolver {
  private readonly client = new MockRiotClient();

  async resolve(identity: Parameters<RiotIdentityResolver["resolve"]>[0]) {
    return this.client.resolveRiotId(identity.gameName, identity.tagLine);
  }
}

export { mockRiotIdentityFixtures };
