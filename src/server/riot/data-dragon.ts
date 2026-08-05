import "server-only";

import { z } from "zod";

import { RiotApiError } from "@/features/riot/errors";
import type {
  StaticChampion,
  StaticDataSnapshot,
  StaticItem,
  StaticRune,
} from "@/features/riot/types";

const DATA_DRAGON_HOST = "ddragon.leagueoflegends.com";
const DEFAULT_LOCALE = "ko_KR";
const DEFAULT_TIMEOUT_MS = 8_000;
const VERSION_CACHE_TTL_MS = 60 * 60 * 1_000;

const imageSchema = z.object({ full: z.string().min(1) }).passthrough();
const championSchema = z
  .object({
    id: z.string().min(1),
    key: z.string().regex(/^\d+$/u),
    name: z.string().min(1),
    title: z.string(),
    tags: z.array(z.string()),
    image: imageSchema.optional(),
  })
  .passthrough();
const championResponseSchema = z
  .object({ data: z.record(z.string(), championSchema) })
  .passthrough();

const itemSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().default(""),
    tags: z.array(z.string()).default([]),
    gold: z
      .object({
        total: z.number().int().nonnegative(),
        purchasable: z.boolean(),
      })
      .passthrough(),
    from: z.array(z.string().regex(/^\d+$/u)).optional(),
    into: z.array(z.string().regex(/^\d+$/u)).optional(),
    image: imageSchema.optional(),
  })
  .passthrough();
const itemResponseSchema = z
  .object({ data: z.record(z.string().regex(/^\d+$/u), itemSchema) })
  .passthrough();

const runeSchema = z
  .object({
    id: z.number().int().positive(),
    key: z.string().min(1),
    name: z.string().min(1),
    icon: z.string().optional(),
  })
  .passthrough();
const runeStyleSchema = runeSchema.extend({
  slots: z
    .array(z.object({ runes: z.array(runeSchema) }).passthrough())
    .default([]),
});

type DataDragonClientOptions = {
  fetch?: typeof fetch;
  locale?: string;
  timeoutMs?: number;
  now?: () => number;
  fallback?: StaticDataSnapshot;
};

const fallbackChampions = [
  [86, "Garen", "가렌", "데마시아의 힘", ["Fighter", "Tank"]],
  [64, "LeeSin", "리 신", "눈먼 수도승", ["Fighter", "Assassin"]],
  [103, "Ahri", "아리", "구미호", ["Mage", "Assassin"]],
  [222, "Jinx", "징크스", "난폭한 말괄량이", ["Marksman"]],
  [412, "Thresh", "쓰레쉬", "지옥의 간수", ["Support", "Tank"]],
] as const;

const fallbackItemRows: ReadonlyArray<
  readonly [number, string, readonly string[], number]
> = [
  [1001, "속도의 장화", ["Boots"], 300],
  [2003, "체력 물약", ["Consumable", "HealthRegen"], 50],
  [2055, "제어 와드", ["Consumable", "Vision"], 75],
  [1054, "도란의 방패", ["Lane"], 450],
  [1055, "도란의 검", ["Lane"], 450],
  [1056, "도란의 반지", ["Lane"], 400],
  [3340, "투명 와드", ["Trinket", "Vision"], 0],
  [3865, "세계 지도집", ["Vision", "GoldPer", "Lane"], 400],
];

const fallbackItems: StaticItem[] = fallbackItemRows.map(
  ([id, name, tags, totalGold]) => ({
    id,
    name,
    description: "",
    tags: [...tags],
    totalGold,
    purchasable: true,
    from: [],
    into: [],
    imageFile: null,
  }),
);

fallbackItems.push({
  id: 3078,
  name: "삼위일체",
  description: "",
  tags: ["Damage", "AttackSpeed"],
  totalGold: 3_333,
  purchasable: true,
  from: [3057, 3044, 3067],
  into: [],
  imageFile: null,
});

const fallbackRunes = [
  [8000, "Precision", "정밀"],
  [8100, "Domination", "지배"],
  [8200, "Sorcery", "마법"],
  [8300, "Inspiration", "영감"],
  [8400, "Resolve", "결의"],
] as const;

export const bundledStaticDataFallback: StaticDataSnapshot = {
  version: "BUNDLED-2026-08",
  locale: DEFAULT_LOCALE,
  source: "BUNDLED_FALLBACK",
  champions: new Map<number, StaticChampion>(
    fallbackChampions.map(([id, key, name, title, tags]) => [
      id,
      { id, key, name, title, tags: [...tags], imageFile: null },
    ]),
  ),
  items: new Map<number, StaticItem>(
    fallbackItems.map((item) => [item.id, item]),
  ),
  runes: new Map<number, StaticRune>(
    fallbackRunes.map(([id, key, name]) => [id, { id, key, name, icon: null }]),
  ),
};

function versionParts(value: string): [number, number, number] | null {
  const [major, minor, patch] = value.split(".").map(Number);
  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(patch)
  ) {
    return null;
  }
  return [major ?? 0, minor ?? 0, patch ?? 0];
}

/** Select the exact patch when available, otherwise the closest patch in the same season. */
export function selectDataDragonVersion(
  gameVersion: string | undefined,
  versions: readonly string[],
): string | undefined {
  if (versions.length === 0) return undefined;
  const requested = gameVersion ? versionParts(gameVersion) : null;
  if (!requested) return versions[0];
  const candidates = versions
    .map((version, index) => ({ version, index, parts: versionParts(version) }))
    .filter(
      (
        entry,
      ): entry is {
        version: string;
        index: number;
        parts: [number, number, number];
      } => entry.parts !== null && entry.parts[0] === requested[0],
    )
    .sort((left, right) => {
      const leftDistance = Math.abs(left.parts[1] - requested[1]);
      const rightDistance = Math.abs(right.parts[1] - requested[1]);
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      const leftFuture = left.parts[1] > requested[1] ? 1 : 0;
      const rightFuture = right.parts[1] > requested[1] ? 1 : 0;
      if (leftFuture !== rightFuture) return leftFuture - rightFuture;
      if (left.parts[1] !== right.parts[1])
        return right.parts[1] - left.parts[1];
      if (left.parts[2] !== right.parts[2])
        return right.parts[2] - left.parts[2];
      return left.index - right.index;
    });
  return candidates[0]?.version ?? versions[0];
}

function cached(snapshot: StaticDataSnapshot): StaticDataSnapshot {
  return { ...snapshot, source: "CACHE" };
}

export class DataDragonClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly locale: string;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly fallback: StaticDataSnapshot;
  private readonly snapshots = new Map<string, StaticDataSnapshot>();
  private versions: string[] = [];
  private versionsFetchedAt = 0;
  private lastSuccessful: StaticDataSnapshot | null = null;

  constructor(options: DataDragonClientOptions = {}) {
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.locale = options.locale ?? DEFAULT_LOCALE;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
    this.fallback = options.fallback ?? bundledStaticDataFallback;
  }

  async getStaticData(gameVersion?: string): Promise<StaticDataSnapshot> {
    try {
      const versions = await this.getVersions();
      const version = selectDataDragonVersion(gameVersion, versions);
      if (!version)
        return this.lastSuccessful
          ? cached(this.lastSuccessful)
          : this.fallback;
      const existing = this.snapshots.get(version);
      if (existing) return cached(existing);
      const loaded = await this.loadSnapshot(version);
      this.snapshots.set(version, loaded);
      this.lastSuccessful = loaded;
      return loaded;
    } catch {
      return this.lastSuccessful ? cached(this.lastSuccessful) : this.fallback;
    }
  }

  private async getVersions() {
    if (
      this.versions.length > 0 &&
      this.now() - this.versionsFetchedAt < VERSION_CACHE_TTL_MS
    ) {
      return this.versions;
    }
    const raw = await this.fetchJson(
      `https://${DATA_DRAGON_HOST}/api/versions.json`,
    );
    const parsed = z.array(z.string().min(1)).safeParse(raw);
    if (!parsed.success || parsed.data.length === 0) {
      throw new RiotApiError(
        "RIOT_STATIC_DATA_UNAVAILABLE",
        "Data Dragon 버전 정보를 확인하지 못했습니다.",
        true,
      );
    }
    this.versions = parsed.data;
    this.versionsFetchedAt = this.now();
    return this.versions;
  }

  private async loadSnapshot(version: string): Promise<StaticDataSnapshot> {
    const base = `https://${DATA_DRAGON_HOST}/cdn/${encodeURIComponent(version)}/data/${encodeURIComponent(this.locale)}`;
    const [championRaw, itemRaw, runeRaw] = await Promise.all([
      this.fetchJson(`${base}/champion.json`),
      this.fetchJson(`${base}/item.json`),
      this.fetchJson(`${base}/runesReforged.json`),
    ]);
    const champions = championResponseSchema.safeParse(championRaw);
    const items = itemResponseSchema.safeParse(itemRaw);
    const runes = z.array(runeStyleSchema).safeParse(runeRaw);
    if (!champions.success || !items.success || !runes.success) {
      throw new RiotApiError(
        "RIOT_MALFORMED_RESPONSE",
        "Data Dragon 응답 형식이 예상과 다릅니다.",
        true,
      );
    }

    const championMap = new Map<number, StaticChampion>();
    for (const champion of Object.values(champions.data.data)) {
      const id = Number(champion.key);
      championMap.set(id, {
        id,
        key: champion.id,
        name: champion.name,
        title: champion.title,
        tags: champion.tags,
        imageFile: champion.image?.full ?? null,
      });
    }
    const itemMap = new Map<number, StaticItem>();
    for (const [idText, item] of Object.entries(items.data.data)) {
      const id = Number(idText);
      itemMap.set(id, {
        id,
        name: item.name,
        description: item.description,
        tags: item.tags,
        totalGold: item.gold.total,
        purchasable: item.gold.purchasable,
        from: (item.from ?? []).map(Number),
        into: (item.into ?? []).map(Number),
        imageFile: item.image?.full ?? null,
      });
    }
    const runeMap = new Map<number, StaticRune>();
    for (const style of runes.data) {
      runeMap.set(style.id, {
        id: style.id,
        key: style.key,
        name: style.name,
        icon: style.icon ?? null,
      });
      for (const slot of style.slots) {
        for (const rune of slot.runes) {
          runeMap.set(rune.id, {
            id: rune.id,
            key: rune.key,
            name: rune.name,
            icon: rune.icon ?? null,
          });
        }
      }
    }
    return {
      version,
      locale: this.locale,
      source: "DATA_DRAGON",
      champions: championMap,
      items: itemMap,
      runes: runeMap,
    };
  }

  private async fetchJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImplementation(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new RiotApiError(
          "RIOT_STATIC_DATA_UNAVAILABLE",
          "Data Dragon 요청을 처리하지 못했습니다.",
          true,
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof RiotApiError) throw error;
      throw new RiotApiError(
        "RIOT_STATIC_DATA_UNAVAILABLE",
        "Data Dragon 네트워크 요청에 실패했습니다.",
        true,
        undefined,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
