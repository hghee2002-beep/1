const DATA_DRAGON_ORIGIN = "https://ddragon.leagueoflegends.com";

/**
 * Default visual asset patch. Keep this aligned with the latest published
 * Data Dragon version after checking Riot's versions endpoint.
 */
export const DEFAULT_DATA_DRAGON_VERSION = "16.15.1";

export const RIOT_RANKED_TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

export type RiotRankedTier = (typeof RIOT_RANKED_TIERS)[number];

const rankedEmblemPaths: Readonly<Record<RiotRankedTier, string>> = {
  IRON: "/riot/ranked-emblems/iron.png",
  BRONZE: "/riot/ranked-emblems/bronze.png",
  SILVER: "/riot/ranked-emblems/silver.png",
  GOLD: "/riot/ranked-emblems/gold.png",
  PLATINUM: "/riot/ranked-emblems/platinum.png",
  EMERALD: "/riot/ranked-emblems/emerald.png",
  DIAMOND: "/riot/ranked-emblems/diamond.png",
  MASTER: "/riot/ranked-emblems/master.png",
  GRANDMASTER: "/riot/ranked-emblems/grandmaster.png",
  CHALLENGER: "/riot/ranked-emblems/challenger.png",
};

function validVersion(version: string) {
  return /^\d+\.\d+\.\d+$/u.test(version);
}

function positiveInteger(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function safeFileName(value: string) {
  const trimmed = value.trim();
  return /^[A-Za-z0-9_.-]+$/u.test(trimmed) ? trimmed : null;
}

function safeAssetPath(value: string) {
  const parts = value.trim().replaceAll("\\", "/").split("/");
  if (
    parts.length === 0 ||
    parts.some(
      (part) => !part || part === "." || part === ".." || !safeFileName(part),
    )
  ) {
    return null;
  }
  return parts.map(encodeURIComponent).join("/");
}

function versionedImageUrl(
  group: "champion" | "item" | "profileicon" | "spell",
  fileName: string,
  version = DEFAULT_DATA_DRAGON_VERSION,
) {
  const safeName = safeFileName(fileName);
  if (!safeName || !validVersion(version)) return null;
  return `${DATA_DRAGON_ORIGIN}/cdn/${version}/img/${group}/${encodeURIComponent(safeName)}`;
}

export function riotProfileIconUrl(
  profileIconId: number | null | undefined,
  version = DEFAULT_DATA_DRAGON_VERSION,
) {
  if (profileIconId == null || !positiveInteger(profileIconId)) return null;
  return versionedImageUrl("profileicon", `${profileIconId}.png`, version);
}

export function riotChampionIconUrl(
  championKey: string,
  version = DEFAULT_DATA_DRAGON_VERSION,
) {
  return versionedImageUrl("champion", `${championKey.trim()}.png`, version);
}

export function riotItemIconUrl(
  itemId: number,
  version = DEFAULT_DATA_DRAGON_VERSION,
) {
  if (!positiveInteger(itemId)) return null;
  return versionedImageUrl("item", `${itemId}.png`, version);
}

export function riotSummonerSpellIconUrl(
  imageFile: string,
  version = DEFAULT_DATA_DRAGON_VERSION,
) {
  return versionedImageUrl("spell", imageFile, version);
}

/** Rune image paths come from Data Dragon JSON and are rooted under cdn/img. */
export function riotRuneIconUrl(imagePath: string) {
  const safePath = safeAssetPath(imagePath);
  return safePath ? `${DATA_DRAGON_ORIGIN}/cdn/img/${safePath}` : null;
}

export function normalizeRiotRankedTier(
  tier: string | null | undefined,
): RiotRankedTier | null {
  const normalized = tier?.trim().toUpperCase();
  return (
    RIOT_RANKED_TIERS.find((candidate) => candidate === normalized) ?? null
  );
}

export function riotRankedEmblemPath(tier: string | null | undefined) {
  const normalized = normalizeRiotRankedTier(tier);
  return normalized ? rankedEmblemPaths[normalized] : null;
}
