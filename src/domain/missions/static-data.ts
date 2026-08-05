export type MissionStaticItemInput = {
  id: number;
  name: string;
  tags: readonly string[];
  totalGold: number;
  purchasable: boolean;
  from: readonly number[];
  into: readonly number[];
};

export type MissionStaticChampionInput = {
  id: number;
  tags: readonly string[];
};

export type MissionItemClassification = {
  id: number;
  totalGold: number;
  controlWard: boolean;
  potion: boolean;
  doran: boolean;
  supportStart: boolean;
  boots: boolean;
  completed: boolean;
  trinket: boolean;
};

export type MissionStaticData = {
  status: "AVAILABLE" | "MISSING";
  version: string | null;
  items: ReadonlyMap<number, MissionItemClassification>;
  championTags: ReadonlyMap<number, readonly string[]>;
};

function hasTag(item: MissionStaticItemInput, tag: string) {
  return item.tags.includes(tag);
}

export function classifyMissionItem(
  item: MissionStaticItemInput,
): MissionItemClassification {
  const consumable = hasTag(item, "Consumable");
  const vision = hasTag(item, "Vision");
  const boots = hasTag(item, "Boots");
  const trinket = hasTag(item, "Trinket");
  const goldPer = hasTag(item, "GoldPer");
  const jungle = hasTag(item, "Jungle");
  const potion =
    consumable &&
    !vision &&
    (hasTag(item, "HealthRegen") || hasTag(item, "ManaRegen"));
  const doran = /(?:doran|도란)/iu.test(item.name);
  const supportStart =
    item.purchasable && vision && goldPer && item.from.length === 0;
  const completed =
    item.purchasable &&
    item.totalGold > 0 &&
    item.from.length > 0 &&
    item.into.length === 0 &&
    !consumable &&
    !boots &&
    !trinket &&
    !goldPer &&
    !jungle;

  return {
    id: item.id,
    totalGold: item.totalGold,
    controlWard:
      item.id === 2055 ||
      (consumable && vision && /(?:control ward|제어 와드)/iu.test(item.name)),
    potion,
    doran,
    supportStart,
    boots,
    completed,
    trinket,
  };
}

export function buildMissionStaticData(input: {
  version: string;
  items: Iterable<MissionStaticItemInput>;
  champions: Iterable<MissionStaticChampionInput>;
}): MissionStaticData {
  return {
    status: "AVAILABLE",
    version: input.version,
    items: new Map(
      [...input.items].map((item) => [item.id, classifyMissionItem(item)]),
    ),
    championTags: new Map(
      [...input.champions].map((champion) => [champion.id, [...champion.tags]]),
    ),
  };
}

export const missingMissionStaticData: MissionStaticData = {
  status: "MISSING",
  version: null,
  items: new Map(),
  championTags: new Map(),
};
