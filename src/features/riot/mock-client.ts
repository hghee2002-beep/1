import { createHash } from "node:crypto";

import { RiotApiError } from "@/features/riot/errors";
import { normalizedRiotId, parseRiotIdParts } from "@/features/riot/identity";
import {
  RANKED_SOLO_QUEUE,
  type MatchListInput,
  type NormalizedMatch,
  type NormalizedParticipant,
  type NormalizedTeam,
  type NormalizedTimeline,
  type RankedSoloSnapshot,
  type RiotClient,
  type RiotIdentity,
  type RiotPosition,
  type StaticChampion,
  type StaticDataSnapshot,
  type StaticItem,
  type StaticRune,
} from "@/features/riot/types";

const FIXED_NOW = new Date("2026-08-01T03:00:00.000Z");
const TRACKED_PUUID = "MOCK_PUUID_CLOUD_TEMPO_0217";

function ranked(
  tier: string,
  rank: string,
  leaguePoints: number,
): RankedSoloSnapshot {
  return {
    queueType: RANKED_SOLO_QUEUE,
    tier,
    rank,
    leaguePoints,
    wins: 42,
    losses: 31,
    hotStreak: false,
    veteran: false,
    freshBlood: false,
    inactive: false,
  };
}

function identity(
  input: Omit<RiotIdentity, "source" | "summonerLevel"> & {
    summonerLevel?: number;
  },
): RiotIdentity {
  return {
    ...input,
    summonerLevel: input.summonerLevel ?? 120,
    source: "MOCK",
  };
}

const MOCK_ACCOUNTS = [
  identity({
    puuid: TRACKED_PUUID,
    summonerId: "MOCK_SUMMONER_CLOUD_TEMPO_0217",
    gameName: "Cloud Tempo",
    tagLine: "0217",
    profileIconId: 29,
    summonerLevel: 411,
    soloQueue: ranked("MASTER", "I", 186),
  }),
  identity({
    puuid: "MOCK_PUUID_APPROVAL_READY_KR1",
    summonerId: "MOCK_SUMMONER_APPROVAL_READY_KR1",
    gameName: "ApprovalReady",
    tagLine: "KR1",
    profileIconId: 12,
    soloQueue: ranked("DIAMOND", "II", 54),
  }),
  identity({
    puuid: "MOCK_PUUID_APPROVAL_PENDING_WAIT",
    summonerId: "MOCK_SUMMONER_APPROVAL_PENDING_WAIT",
    gameName: "ApprovalPendingPlayer",
    tagLine: "WAIT",
    profileIconId: 7,
    soloQueue: ranked("EMERALD", "II", 42),
  }),
  identity({
    puuid: "DEMO_ONLY_PUUID_001",
    summonerId: "DEMO_ONLY_SUMMONER_001",
    gameName: "GraphiteCarry",
    tagLine: "KR001",
    profileIconId: 1,
    soloQueue: ranked("EMERALD", "I", 88),
  }),
  identity({
    puuid: "MOCK_PUUID_RENAMED_LONG_ID",
    summonerId: "MOCK_SUMMONER_RENAMED_LONG_ID",
    gameName: "A Very Long Changed Riot Identifier",
    tagLine: "SHIFT",
    profileIconId: 18,
    soloQueue: ranked("PLATINUM", "I", 77),
  }),
] as const satisfies readonly RiotIdentity[];

const accountByRiotId = new Map(
  MOCK_ACCOUNTS.map((account) => [
    normalizedRiotId(account.gameName, account.tagLine),
    account,
  ]),
);
accountByRiotId.set(
  normalizedRiotId("OldDisplayName", "KR1"),
  MOCK_ACCOUNTS[4],
);
const accountByPuuid = new Map(
  MOCK_ACCOUNTS.map((account) => [account.puuid, account]),
);

function mockFailure(gameName: string, tagLine: string): RiotApiError | null {
  const normalized = normalizedRiotId(gameName, tagLine);
  if (normalized === normalizedRiotId("NotFound", "KR1")) {
    return new RiotApiError(
      "RIOT_ACCOUNT_NOT_FOUND",
      "해당 Riot ID를 찾을 수 없습니다.",
    );
  }
  if (normalized === normalizedRiotId("TemporaryFailure", "KR1")) {
    return new RiotApiError(
      "RIOT_TEMPORARY_FAILURE",
      "Riot 계정 확인이 일시적으로 지연되고 있습니다.",
      true,
    );
  }
  if (normalized === normalizedRiotId("RateLimited", "KR1")) {
    return new RiotApiError(
      "RIOT_RATE_LIMITED",
      "Riot API 요청 한도에 도달했습니다.",
      true,
      60,
    );
  }
  if (normalized === normalizedRiotId("InvalidKey", "KR1")) {
    return new RiotApiError(
      "RIOT_KEY_INVALID",
      "Riot API 자격 증명을 확인할 수 없습니다.",
    );
  }
  return null;
}

const positions: Exclude<RiotPosition, null>[] = [
  "TOP",
  "JUNGLE",
  "MIDDLE",
  "BOTTOM",
  "UTILITY",
];
const champions = [
  [86, "Garen"],
  [64, "LeeSin"],
  [103, "Ahri"],
  [222, "Jinx"],
  [412, "Thresh"],
] as const;

function participant(
  participantId: number,
  teamId: number,
  win: boolean,
  tracked: boolean,
): NormalizedParticipant {
  const index = (participantId - 1) % 5;
  const champion = champions[index] ?? champions[0];
  return {
    participantId,
    puuid: tracked ? TRACKED_PUUID : `MOCK_PUUID_${participantId}`,
    teamId,
    position: positions[index] ?? null,
    championId: champion[0],
    championName: champion[1],
    championLevel: 16,
    win,
    kills: tracked ? 12 : 4 + index,
    deaths: tracked ? 2 : 3 + (index % 2),
    assists: tracked ? 11 : 7 + index,
    totalMinionsKilled: 170 + index * 8,
    neutralMinionsKilled: index === 1 ? 82 : 8,
    cs: 178 + index * 8 + (index === 1 ? 74 : 0),
    goldEarned: 14_500 + index * 350,
    damageToChampions: 24_000 + index * 1_500,
    damageTaken: 21_000 + index * 2_000,
    damageMitigated: 16_000 + index * 2_500,
    damageToObjectives: 18_000 + index * 1_000,
    damageToTurrets: 4_200 + index * 300,
    visionScore: 34 + index * 12,
    wardsPlaced: 8 + index * 2,
    wardsKilled: 3 + index,
    controlWardsBought: 2 + (index % 2),
    timeCCingOthers: 18 + index * 6,
    healOnTeammates: index === 4 ? 7_000 : 0,
    shieldOnTeammates: index === 4 ? 6_000 : 0,
    doubleKills: tracked ? 1 : 0,
    tripleKills: tracked ? 1 : 0,
    quadraKills: 0,
    pentaKills: 0,
    largestKillingSpree: tracked ? 6 : 3,
    firstBloodKill: tracked,
    firstBloodAssist: false,
    firstTowerKill: index === 0,
    firstTowerAssist: index === 1,
    turretKills: index === 0 ? 2 : 0,
    turretAssists: index === 1 ? 2 : 0,
    inhibitorKills: index === 3 ? 1 : 0,
    inhibitorAssists: index === 4 ? 1 : 0,
    inhibitorTakedowns: index === 3 ? 1 : 0,
    items: [1055, 3006, 3031, 3094],
    perkStyles: [
      { styleId: 8000, selections: [8005, 9111, 9104, 8014] },
      { styleId: 8200, selections: [8233, 8236] },
    ],
    summonerSpellIds: index === 1 ? [11, 4] : [4, 14],
    earlySurrender: false,
    surrender: false,
    challenges: {
      soloKills: tracked ? 3 : 1,
      turretTakedowns: 3,
      inhibitorTakedowns: index === 3 ? 1 : 0,
      objectivesStolen: index === 1 ? 1 : 0,
      controlWardsPlaced: 2 + (index % 2),
      longestTimeSpentLiving: 920,
    },
  };
}

function objective(kills: number, first = false) {
  return { kills, first };
}

function team(
  teamId: number,
  win: boolean,
  championKills: number,
): NormalizedTeam {
  return {
    teamId,
    win,
    championKills,
    objectives: {
      baron: objective(win ? 1 : 0, win),
      champion: objective(championKills),
      dragon: objective(win ? 3 : 1, win),
      inhibitor: objective(win ? 2 : 0, win),
      riftHerald: objective(win ? 1 : 0, win),
      tower: objective(win ? 9 : 3, win),
    },
  };
}

function createMatch(input: {
  matchId: string;
  startAt: Date;
  trackedWin: boolean;
  durationSeconds?: number;
  queueId?: number;
  earlySurrender?: boolean;
}): NormalizedMatch {
  const durationSeconds = input.durationSeconds ?? 1_920;
  const participants = Array.from({ length: 10 }, (_, index) => {
    const participantId = index + 1;
    const firstTeam = participantId <= 5;
    const wins = firstTeam ? input.trackedWin : !input.trackedWin;
    return participant(
      participantId,
      firstTeam ? 100 : 200,
      wins,
      participantId === 1,
    );
  });
  if (input.earlySurrender) {
    participants[0] = {
      ...(participants[0] ?? participant(1, 100, input.trackedWin, true)),
      earlySurrender: true,
    };
  }
  const teamKills = (teamId: number) =>
    participants
      .filter((candidate) => candidate.teamId === teamId)
      .reduce((sum, candidate) => sum + candidate.kills, 0);
  return {
    matchId: input.matchId,
    dataVersion: "2",
    platformId: "KR",
    queueId: input.queueId ?? 420,
    mapId: 11,
    gameMode: "CLASSIC",
    gameType: "MATCHED_GAME",
    gameVersion: "16.15.1.7028314",
    gameStartAt: new Date(input.startAt),
    gameEndAt: new Date(input.startAt.getTime() + durationSeconds * 1_000),
    durationSeconds,
    earlySurrender: input.earlySurrender ?? false,
    remake: durationSeconds < 600,
    participants,
    teams: [
      team(100, input.trackedWin, teamKills(100)),
      team(200, !input.trackedWin, teamKills(200)),
    ],
  };
}

function createTimeline(matchId: string): NormalizedTimeline {
  const participantPuuids = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [
      String(index + 1),
      index === 0 ? TRACKED_PUUID : `MOCK_PUUID_${index + 1}`,
    ]),
  );
  const frame = (
    timestampMs: number,
  ): NormalizedTimeline["frames"][number] => ({
    timestampMs,
    participantFrames: Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        String(index + 1),
        {
          participantId: index + 1,
          timestampMs,
          level: Math.max(1, Math.floor(timestampMs / 60_000)),
          currentGold: 500,
          totalGold: 500 + Math.floor(timestampMs / 100),
          minionsKilled: Math.floor(timestampMs / 12_000),
          jungleMinionsKilled:
            index === 1 ? Math.floor(timestampMs / 20_000) : 0,
          xp: Math.floor(timestampMs / 50),
        },
      ]),
    ),
    events: [],
  });
  const frames = [frame(0), frame(600_000), frame(900_000)];
  const firstFrame = frames[0];
  const secondFrame = frames[1];
  if (firstFrame) {
    firstFrame.events.push({
      type: "ITEM_PURCHASED",
      timestampMs: 80_000,
      participantId: 1,
      creatorId: null,
      killerId: null,
      victimId: null,
      assistingParticipantIds: [],
      itemId: 1055,
      beforeId: null,
      afterId: null,
      monsterType: null,
      monsterSubType: null,
    });
  }
  if (secondFrame) {
    secondFrame.events.push(
      {
        type: "CHAMPION_KILL",
        timestampMs: 240_000,
        participantId: null,
        creatorId: null,
        killerId: 1,
        victimId: 6,
        assistingParticipantIds: [2, 3],
        itemId: null,
        beforeId: null,
        afterId: null,
        monsterType: null,
        monsterSubType: null,
      },
      {
        type: "ELITE_MONSTER_KILL",
        timestampMs: 540_000,
        participantId: null,
        creatorId: null,
        killerId: 2,
        victimId: null,
        assistingParticipantIds: [1, 3, 4],
        itemId: null,
        beforeId: null,
        afterId: null,
        monsterType: "DRAGON",
        monsterSubType: "FIRE_DRAGON",
      },
    );
  }
  return {
    matchId,
    dataVersion: "2",
    frameIntervalMs: 60_000,
    participantPuuids,
    frames,
  };
}

function mockStaticData(): StaticDataSnapshot {
  const championMap = new Map<number, StaticChampion>(
    champions.map(([id, key]) => [
      id,
      {
        id,
        key,
        name: key,
        title: "Mock fixture",
        tags: id === 222 ? ["Marksman"] : id === 103 ? ["Mage"] : ["Fighter"],
        imageFile: `${key}.png`,
      },
    ]),
  );
  const itemMap = new Map<number, StaticItem>([
    [
      2055,
      {
        id: 2055,
        name: "Control Ward",
        description: "",
        tags: ["Vision"],
        totalGold: 75,
        purchasable: true,
        from: [],
        into: [],
        imageFile: "2055.png",
      },
    ],
    [
      1055,
      {
        id: 1055,
        name: "Doran's Blade",
        description: "",
        tags: ["Lane"],
        totalGold: 450,
        purchasable: true,
        from: [],
        into: [],
        imageFile: "1055.png",
      },
    ],
    [
      3006,
      {
        id: 3006,
        name: "Berserker's Greaves",
        description: "",
        tags: ["Boots"],
        totalGold: 1100,
        purchasable: true,
        from: [1001],
        into: [],
        imageFile: "3006.png",
      },
    ],
  ]);
  const runeMap = new Map<number, StaticRune>([
    [
      8000,
      { id: 8000, key: "Precision", name: "Precision", icon: "precision.png" },
    ],
    [8200, { id: 8200, key: "Sorcery", name: "Sorcery", icon: "sorcery.png" }],
  ]);
  return {
    version: "MOCK-16.15.1",
    locale: "ko_KR",
    source: "MOCK",
    champions: championMap,
    items: itemMap,
    runes: runeMap,
  };
}

export const mockRiotIdentityFixtures = MOCK_ACCOUNTS;

export class MockRiotClient implements RiotClient {
  private readonly matches: Map<string, NormalizedMatch>;
  private readonly timelineAttempts = new Map<string, number>();

  constructor(now = FIXED_NOW) {
    const at = (minutesAgo: number) =>
      new Date(now.getTime() - minutesAgo * 60_000);
    const fixtures = [
      createMatch({
        matchId: "KR_MOCK_WIN_001",
        startAt: at(30),
        trackedWin: true,
      }),
      createMatch({
        matchId: "KR_MOCK_LOSS_001",
        startAt: at(90),
        trackedWin: false,
      }),
      createMatch({
        matchId: "KR_MOCK_REMAKE_001",
        startAt: at(150),
        trackedWin: false,
        durationSeconds: 240,
        earlySurrender: true,
      }),
      createMatch({
        matchId: "KR_MOCK_UNSUPPORTED_QUEUE_001",
        startAt: at(210),
        trackedWin: true,
        queueId: 440,
      }),
      createMatch({
        matchId: "KR_MOCK_TIMELINE_001",
        startAt: at(270),
        trackedWin: true,
      }),
      createMatch({
        matchId: "KR_MOCK_TIMELINE_RETRY_001",
        startAt: at(330),
        trackedWin: true,
      }),
    ];
    this.matches = new Map(fixtures.map((match) => [match.matchId, match]));
  }

  async resolveRiotId(
    gameName: string,
    tagLine: string,
  ): Promise<RiotIdentity> {
    const parsed = parseRiotIdParts({ gameName, tagLine });
    const failure = mockFailure(parsed.gameName, parsed.tagLine);
    if (failure) throw failure;
    const account = accountByRiotId.get(parsed.normalized);
    if (account) return structuredClone(account);
    if (parsed.gameName.startsWith("E2E-") && parsed.tagLine === "TEST") {
      const suffix = createHash("sha256")
        .update(parsed.normalized)
        .digest("hex")
        .slice(0, 24);
      return identity({
        puuid: `MOCK_E2E_PUUID_${suffix}`,
        summonerId: `MOCK_E2E_SUMMONER_${suffix}`,
        gameName: parsed.gameName,
        tagLine: parsed.tagLine,
        profileIconId: 29,
        summonerLevel: 100,
        soloQueue: ranked("EMERALD", "III", 30),
      });
    }
    throw new RiotApiError(
      "RIOT_ACCOUNT_NOT_FOUND",
      "Mock 모드에 등록된 Riot ID가 아닙니다.",
    );
  }

  async getIdentityByPuuid(puuid: string): Promise<RiotIdentity> {
    const account = accountByPuuid.get(puuid);
    if (!account) {
      throw new RiotApiError(
        "RIOT_ACCOUNT_NOT_FOUND",
        "Mock 모드에 등록된 PUUID가 아닙니다.",
      );
    }
    return structuredClone(account);
  }

  async getSummonerByPuuid(puuid: string) {
    const account = await this.getIdentityByPuuid(puuid);
    return {
      id: account.summonerId,
      puuid: account.puuid,
      profileIconId: account.profileIconId,
      summonerLevel: account.summonerLevel,
    };
  }

  async getSoloQueueSnapshot(puuid: string) {
    const account = await this.getIdentityByPuuid(puuid);
    return account.soloQueue;
  }

  async listMatchIds(input: MatchListInput): Promise<string[]> {
    if (!input.puuid.trim()) {
      throw new RiotApiError("RIOT_ID_INVALID", "PUUID가 필요합니다.");
    }
    const start = input.start ?? 0;
    const count = input.count ?? 20;
    if (
      !Number.isInteger(start) ||
      start < 0 ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 100
    ) {
      throw new RiotApiError(
        "RIOT_ID_INVALID",
        "페이지 범위가 잘못되었습니다.",
      );
    }
    const matches = [...this.matches.values()]
      .filter((match) =>
        match.participants.some(
          (participant) => participant.puuid === input.puuid,
        ),
      )
      .filter(
        (match) =>
          input.queueId === undefined || match.queueId === input.queueId,
      )
      .filter(
        (match) => !input.startTime || match.gameStartAt >= input.startTime,
      )
      .filter((match) => !input.endTime || match.gameStartAt <= input.endTime)
      .sort(
        (left, right) =>
          right.gameStartAt.getTime() - left.gameStartAt.getTime(),
      );
    return matches.slice(start, start + count).map((match) => match.matchId);
  }

  async getMatch(matchId: string): Promise<NormalizedMatch> {
    const match = this.matches.get(matchId);
    if (!match) {
      throw new RiotApiError(
        "RIOT_RESOURCE_NOT_FOUND",
        "Mock match fixture를 찾을 수 없습니다.",
      );
    }
    return structuredClone(match);
  }

  async getTimeline(matchId: string): Promise<NormalizedTimeline> {
    if (matchId === "KR_MOCK_TIMELINE_MISSING_001") {
      throw new RiotApiError(
        "RIOT_TIMELINE_UNAVAILABLE",
        "Mock timeline fixture가 누락되었습니다.",
        true,
      );
    }
    if (matchId === "KR_MOCK_TIMELINE_RETRY_001") {
      const attempts = (this.timelineAttempts.get(matchId) ?? 0) + 1;
      this.timelineAttempts.set(matchId, attempts);
      if (attempts === 1) {
        throw new RiotApiError(
          "RIOT_TEMPORARY_FAILURE",
          "Mock timeline이 일시적으로 준비되지 않았습니다.",
          true,
        );
      }
    }
    if (!this.matches.has(matchId)) {
      throw new RiotApiError(
        "RIOT_RESOURCE_NOT_FOUND",
        "Mock match fixture를 찾을 수 없습니다.",
      );
    }
    return structuredClone(createTimeline(matchId));
  }

  async getStaticData(): Promise<StaticDataSnapshot> {
    return mockStaticData();
  }
}
