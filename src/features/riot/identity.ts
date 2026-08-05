import { RiotApiError } from "@/features/riot/errors";
import type { RankedSoloSnapshot, RiotIdentity } from "@/features/riot/types";

export { RiotApiError as RiotIdentityError } from "@/features/riot/errors";

export const RIOT_GAME_NAME_MAX_LENGTH = 128;
export const RIOT_TAG_LINE_MAX_LENGTH = 32;

export type RiotIdentityErrorCode =
  | "RIOT_ID_INVALID"
  | "RIOT_ACCOUNT_NOT_FOUND"
  | "RIOT_KEY_INVALID"
  | "RIOT_RATE_LIMITED"
  | "RIOT_TEMPORARY_FAILURE";

export type ParsedRiotId = {
  gameName: string;
  tagLine: string;
  display: string;
  normalized: string;
};

export type RiotSoloQueueEntry = RankedSoloSnapshot;

export type ResolvedRiotIdentity = RiotIdentity;

export interface RiotIdentityResolver {
  resolve(identity: ParsedRiotId): Promise<ResolvedRiotIdentity>;
}

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

function invalidRiotId(message: string): never {
  throw new RiotApiError("RIOT_ID_INVALID", message);
}

function normalizeSearchPart(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

export function normalizedRiotId(gameName: string, tagLine: string) {
  return `${normalizeSearchPart(gameName)}#${normalizeSearchPart(tagLine)}`;
}

export function parseRiotIdParts(input: {
  gameName: string;
  tagLine: string;
}): ParsedRiotId {
  const gameName = input.gameName.trim();
  const tagLine = input.tagLine.trim();

  if (!gameName || !tagLine) {
    return invalidRiotId("게임 이름과 태그라인을 모두 입력해 주세요.");
  }
  if (gameName.includes("#") || tagLine.includes("#")) {
    return invalidRiotId("#은 구분자로 한 번만 사용할 수 있습니다.");
  }
  if (
    CONTROL_CHARACTER_PATTERN.test(gameName) ||
    CONTROL_CHARACTER_PATTERN.test(tagLine)
  ) {
    return invalidRiotId("Riot ID에 사용할 수 없는 문자가 포함되어 있습니다.");
  }
  if (gameName.length > RIOT_GAME_NAME_MAX_LENGTH) {
    return invalidRiotId(
      `게임 이름은 ${RIOT_GAME_NAME_MAX_LENGTH}자 이하여야 합니다.`,
    );
  }
  if (tagLine.length > RIOT_TAG_LINE_MAX_LENGTH) {
    return invalidRiotId(
      `태그라인은 ${RIOT_TAG_LINE_MAX_LENGTH}자 이하여야 합니다.`,
    );
  }

  return {
    gameName,
    tagLine,
    display: `${gameName}#${tagLine}`,
    normalized: normalizedRiotId(gameName, tagLine),
  };
}

export function parseRiotId(value: string): ParsedRiotId {
  const separators = [...value].filter((character) => character === "#").length;
  if (separators !== 1) {
    return invalidRiotId("Riot ID는 gameName#tagLine 형식이어야 합니다.");
  }

  const separatorIndex = value.indexOf("#");
  return parseRiotIdParts({
    gameName: value.slice(0, separatorIndex),
    tagLine: value.slice(separatorIndex + 1),
  });
}
