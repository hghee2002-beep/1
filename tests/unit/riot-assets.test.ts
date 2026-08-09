import { describe, expect, it } from "vitest";

import {
  DEFAULT_DATA_DRAGON_VERSION,
  normalizeRiotRankedTier,
  riotChampionIconUrl,
  riotItemIconUrl,
  riotProfileIconUrl,
  riotRankedEmblemPath,
  riotRuneIconUrl,
  riotSummonerSpellIconUrl,
} from "@/lib/riot-assets";

describe("Riot official asset paths", () => {
  it("builds reusable versioned Data Dragon image URLs", () => {
    expect(riotProfileIconUrl(29)).toBe(
      `https://ddragon.leagueoflegends.com/cdn/${DEFAULT_DATA_DRAGON_VERSION}/img/profileicon/29.png`,
    );
    expect(riotChampionIconUrl("Ahri")).toContain("/img/champion/Ahri.png");
    expect(riotItemIconUrl(1001)).toContain("/img/item/1001.png");
    expect(riotSummonerSpellIconUrl("SummonerFlash.png")).toContain(
      "/img/spell/SummonerFlash.png",
    );
    expect(riotRuneIconUrl("perk-images/Styles/Precision/Precision.png")).toBe(
      "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Precision.png",
    );
  });

  it("maps Riot tiers to vendored official emblems", () => {
    expect(normalizeRiotRankedTier(" emerald ")).toBe("EMERALD");
    expect(riotRankedEmblemPath("grandmaster")).toBe(
      "/riot/ranked-emblems/grandmaster.png",
    );
    expect(riotRankedEmblemPath("UNRANKED")).toBeNull();
  });

  it("rejects malformed ids, versions, and asset paths", () => {
    expect(riotProfileIconUrl(-1)).toBeNull();
    expect(riotItemIconUrl(0)).toBeNull();
    expect(riotChampionIconUrl("../Ahri")).toBeNull();
    expect(riotProfileIconUrl(29, "latest")).toBeNull();
    expect(riotRuneIconUrl("../private.png")).toBeNull();
  });
});
