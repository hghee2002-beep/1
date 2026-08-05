import "server-only";

import { RiotApiError } from "@/features/riot/errors";
import { parseRiotIdParts } from "@/features/riot/identity";
import {
  normalizeAccount,
  normalizeMatch,
  normalizeMatchIds,
  normalizeSoloQueueEntries,
  normalizeSummoner,
  normalizeTimeline,
} from "@/features/riot/normalizers";
import type {
  MatchListInput,
  NormalizedMatch,
  NormalizedTimeline,
  RankedSoloSnapshot,
  RiotClient,
  RiotIdentity,
  RiotSummoner,
  StaticDataSnapshot,
} from "@/features/riot/types";
import { DataDragonClient } from "@/server/riot/data-dragon";
import {
  RiotHttpClient,
  type RiotHttpClientOptions,
  type RiotHttpObservation,
} from "@/server/riot/http-client";
import { observeRiotHttp } from "@/server/observability/sync-metrics";

export type RealRiotClientOptions = {
  apiKey: string;
  platformRegion?: "KR";
  regionalRoute?: "ASIA";
  httpClient?: RiotHttpClient;
  dataDragon?: DataDragonClient;
  http?: Omit<RiotHttpClientOptions, "apiKey">;
};

function defaultLogger(observation: RiotHttpObservation) {
  observeRiotHttp(observation);
}

function encoded(value: string) {
  return encodeURIComponent(value);
}

function validateMatchListInput(input: MatchListInput) {
  if (!input.puuid.trim()) {
    throw new RiotApiError(
      "RIOT_ID_INVALID",
      "Match 목록 조회에는 PUUID가 필요합니다.",
    );
  }
  if (
    input.start !== undefined &&
    (!Number.isInteger(input.start) || input.start < 0)
  ) {
    throw new RiotApiError(
      "RIOT_ID_INVALID",
      "Match 목록 시작 위치가 잘못되었습니다.",
    );
  }
  if (
    input.count !== undefined &&
    (!Number.isInteger(input.count) || input.count < 1 || input.count > 100)
  ) {
    throw new RiotApiError(
      "RIOT_ID_INVALID",
      "Match 목록 개수는 1~100이어야 합니다.",
    );
  }
  for (const value of [input.startTime, input.endTime]) {
    if (value && Number.isNaN(value.getTime())) {
      throw new RiotApiError(
        "RIOT_ID_INVALID",
        "Match 조회 시각이 잘못되었습니다.",
      );
    }
  }
}

function mapAccountNotFound(error: unknown): never {
  if (
    error instanceof RiotApiError &&
    error.code === "RIOT_RESOURCE_NOT_FOUND"
  ) {
    throw new RiotApiError(
      "RIOT_ACCOUNT_NOT_FOUND",
      "해당 Riot ID를 찾을 수 없습니다.",
      false,
      undefined,
      {
        ...(error.status === undefined ? {} : { status: error.status }),
        ...(error.operation === undefined
          ? {}
          : { operation: error.operation }),
        ...(error.correlationId === undefined
          ? {}
          : { correlationId: error.correlationId }),
        cause: error,
      },
    );
  }
  throw error;
}

export class RealRiotClient implements RiotClient {
  readonly platformHost: string;
  readonly regionalHost: string;
  private readonly http: RiotHttpClient;
  private readonly dataDragon: DataDragonClient;

  constructor(options: RealRiotClientOptions) {
    const platform = options.platformRegion ?? "KR";
    const regional = options.regionalRoute ?? "ASIA";
    this.platformHost = `${platform.toLocaleLowerCase("en-US")}.api.riotgames.com`;
    this.regionalHost = `${regional.toLocaleLowerCase("en-US")}.api.riotgames.com`;
    this.http =
      options.httpClient ??
      new RiotHttpClient({
        apiKey: options.apiKey,
        logger: defaultLogger,
        ...options.http,
      });
    this.dataDragon = options.dataDragon ?? new DataDragonClient();
  }

  async resolveRiotId(
    gameName: string,
    tagLine: string,
  ): Promise<RiotIdentity> {
    const parsed = parseRiotIdParts({ gameName, tagLine });
    let account: ReturnType<typeof normalizeAccount>;
    try {
      const raw = await this.http.requestJson({
        host: this.regionalHost,
        path: `/riot/account/v1/accounts/by-riot-id/${encoded(parsed.gameName)}/${encoded(parsed.tagLine)}`,
        operation: "account.by-riot-id",
      });
      account = normalizeAccount(raw, parsed);
    } catch (error) {
      mapAccountNotFound(error);
    }
    return this.resolveIdentity(account);
  }

  async getIdentityByPuuid(puuid: string): Promise<RiotIdentity> {
    let account: ReturnType<typeof normalizeAccount>;
    try {
      const raw = await this.http.requestJson({
        host: this.regionalHost,
        path: `/riot/account/v1/accounts/by-puuid/${encoded(puuid)}`,
        operation: "account.by-puuid",
      });
      account = normalizeAccount(raw);
    } catch (error) {
      mapAccountNotFound(error);
    }
    return this.resolveIdentity(account);
  }

  async getSummonerByPuuid(puuid: string): Promise<RiotSummoner> {
    const raw = await this.http.requestJson({
      host: this.platformHost,
      path: `/lol/summoner/v4/summoners/by-puuid/${encoded(puuid)}`,
      operation: "summoner.by-puuid",
    });
    return normalizeSummoner(raw);
  }

  async getSoloQueueSnapshot(
    puuid: string,
  ): Promise<RankedSoloSnapshot | null> {
    const raw = await this.http.requestJson({
      host: this.platformHost,
      path: `/lol/league/v4/entries/by-puuid/${encoded(puuid)}`,
      operation: "league.entries-by-puuid",
    });
    return normalizeSoloQueueEntries(raw);
  }

  async listMatchIds(input: MatchListInput): Promise<string[]> {
    validateMatchListInput(input);
    const raw = await this.http.requestJson({
      host: this.regionalHost,
      path: `/lol/match/v5/matches/by-puuid/${encoded(input.puuid)}/ids`,
      operation: "match.ids-by-puuid",
      query: {
        startTime: input.startTime
          ? Math.floor(input.startTime.getTime() / 1_000)
          : undefined,
        endTime: input.endTime
          ? Math.floor(input.endTime.getTime() / 1_000)
          : undefined,
        queue: input.queueId,
        type: input.type,
        start: input.start,
        count: input.count,
      },
    });
    return normalizeMatchIds(raw);
  }

  async getMatch(matchId: string): Promise<NormalizedMatch> {
    const raw = await this.http.requestJson({
      host: this.regionalHost,
      path: `/lol/match/v5/matches/${encoded(matchId)}`,
      operation: "match.by-id",
    });
    const match = normalizeMatch(raw);
    if (match.matchId !== matchId) {
      throw new RiotApiError(
        "RIOT_MALFORMED_RESPONSE",
        "Riot match 식별자가 요청과 일치하지 않습니다.",
        true,
      );
    }
    return match;
  }

  async getTimeline(matchId: string): Promise<NormalizedTimeline> {
    let raw: unknown;
    try {
      raw = await this.http.requestJson({
        host: this.regionalHost,
        path: `/lol/match/v5/matches/${encoded(matchId)}/timeline`,
        operation: "match.timeline",
      });
    } catch (error) {
      if (
        error instanceof RiotApiError &&
        error.code === "RIOT_RESOURCE_NOT_FOUND"
      ) {
        throw new RiotApiError(
          "RIOT_TIMELINE_UNAVAILABLE",
          "Riot match timeline이 아직 제공되지 않습니다.",
          true,
          undefined,
          { cause: error },
        );
      }
      throw error;
    }
    const timeline = normalizeTimeline(raw);
    if (timeline.matchId !== matchId) {
      throw new RiotApiError(
        "RIOT_MALFORMED_RESPONSE",
        "Riot timeline 식별자가 요청과 일치하지 않습니다.",
        true,
      );
    }
    return timeline;
  }

  getStaticData(gameVersion?: string): Promise<StaticDataSnapshot> {
    return this.dataDragon.getStaticData(gameVersion);
  }

  private async resolveIdentity(account: {
    puuid: string;
    gameName: string;
    tagLine: string;
  }): Promise<RiotIdentity> {
    const [summoner, soloQueue] = await Promise.all([
      this.getSummonerByPuuid(account.puuid),
      this.getSoloQueueSnapshot(account.puuid),
    ]);
    if (summoner.puuid !== account.puuid) {
      throw new RiotApiError(
        "RIOT_MALFORMED_RESPONSE",
        "Riot 계정 식별자가 endpoint 사이에서 일치하지 않습니다.",
        true,
      );
    }
    return {
      puuid: account.puuid,
      summonerId: summoner.id,
      gameName: account.gameName,
      tagLine: account.tagLine,
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
      soloQueue,
      source: "RIOT_API",
    };
  }
}
