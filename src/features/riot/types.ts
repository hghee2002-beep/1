export const RANKED_SOLO_QUEUE = "RANKED_SOLO_5x5" as const;

export type RiotDataSource = "MOCK" | "RIOT_API";

export type RankedSoloSnapshot = {
  queueType: typeof RANKED_SOLO_QUEUE;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
  inactive: boolean;
};

export type RiotSummoner = {
  id: string;
  puuid: string;
  profileIconId: number | null;
  summonerLevel: number | null;
};

export type RiotIdentity = {
  puuid: string;
  summonerId: string;
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
  summonerLevel: number | null;
  soloQueue: RankedSoloSnapshot | null;
  source: RiotDataSource;
};

export type RiotPosition =
  "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | null;

export type NormalizedPerkStyle = {
  styleId: number;
  selections: number[];
};

export type NormalizedParticipantChallenges = {
  soloKills: number | null;
  turretTakedowns: number | null;
  inhibitorTakedowns: number | null;
  objectivesStolen: number | null;
  controlWardsPlaced: number | null;
  longestTimeSpentLiving: number | null;
};

export type NormalizedParticipant = {
  participantId: number;
  puuid: string;
  teamId: number;
  position: RiotPosition;
  championId: number;
  championName: string;
  championLevel: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  cs: number;
  goldEarned: number;
  damageToChampions: number;
  damageTaken: number;
  damageMitigated: number;
  damageToObjectives: number;
  damageToTurrets: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  controlWardsBought: number;
  timeCCingOthers: number;
  healOnTeammates: number;
  shieldOnTeammates: number;
  doubleKills: number | null;
  tripleKills: number | null;
  quadraKills: number | null;
  pentaKills: number | null;
  largestKillingSpree: number | null;
  firstBloodKill: boolean | null;
  firstBloodAssist: boolean | null;
  firstTowerKill: boolean | null;
  firstTowerAssist: boolean | null;
  turretKills: number | null;
  turretAssists: number | null;
  inhibitorKills: number | null;
  inhibitorAssists: number | null;
  inhibitorTakedowns: number | null;
  items: number[];
  perkStyles: NormalizedPerkStyle[];
  summonerSpellIds: [number, number];
  earlySurrender: boolean;
  surrender: boolean;
  challenges: NormalizedParticipantChallenges;
};

export type NormalizedObjective = {
  first: boolean;
  kills: number;
};

export type NormalizedTeam = {
  teamId: number;
  win: boolean;
  championKills: number;
  objectives: {
    baron: NormalizedObjective;
    champion: NormalizedObjective;
    dragon: NormalizedObjective;
    inhibitor: NormalizedObjective;
    riftHerald: NormalizedObjective;
    tower: NormalizedObjective;
  };
};

export type MatchSummary = {
  matchId: string;
  dataVersion: string;
  platformId: string;
  queueId: number;
  mapId: number;
  gameMode: string;
  gameType: string;
  gameVersion: string;
  gameStartAt: Date;
  gameEndAt: Date;
  durationSeconds: number;
  earlySurrender: boolean;
  remake: boolean;
};

export type NormalizedMatch = MatchSummary & {
  participants: NormalizedParticipant[];
  teams: NormalizedTeam[];
};

export type NormalizedTimelineEvent = {
  type: string;
  timestampMs: number;
  participantId: number | null;
  creatorId: number | null;
  killerId: number | null;
  victimId: number | null;
  assistingParticipantIds: number[];
  itemId: number | null;
  beforeId: number | null;
  afterId: number | null;
  monsterType: string | null;
  monsterSubType: string | null;
};

export type NormalizedParticipantFrame = {
  participantId: number;
  timestampMs: number;
  level: number;
  currentGold: number;
  totalGold: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
  xp: number;
};

export type NormalizedTimelineFrame = {
  timestampMs: number;
  participantFrames: Record<string, NormalizedParticipantFrame>;
  events: NormalizedTimelineEvent[];
};

export type NormalizedTimeline = {
  matchId: string;
  dataVersion: string;
  frameIntervalMs: number;
  participantPuuids: Record<string, string>;
  frames: NormalizedTimelineFrame[];
};

export type StaticChampion = {
  id: number;
  key: string;
  name: string;
  title: string;
  tags: string[];
  imageFile: string | null;
};

export type StaticItem = {
  id: number;
  name: string;
  description: string;
  tags: string[];
  totalGold: number;
  purchasable: boolean;
  from: number[];
  into: number[];
  imageFile: string | null;
};

export type StaticRune = {
  id: number;
  key: string;
  name: string;
  icon: string | null;
};

export type StaticDataSnapshot = {
  version: string;
  locale: string;
  source: "DATA_DRAGON" | "CACHE" | "BUNDLED_FALLBACK" | "MOCK";
  champions: ReadonlyMap<number, StaticChampion>;
  items: ReadonlyMap<number, StaticItem>;
  runes: ReadonlyMap<number, StaticRune>;
};

export type MatchListInput = {
  puuid: string;
  startTime?: Date;
  endTime?: Date;
  queueId?: number;
  type?: "ranked" | "normal" | "tourney" | "tutorial";
  start?: number;
  count?: number;
};

export interface RiotClient {
  resolveRiotId(gameName: string, tagLine: string): Promise<RiotIdentity>;
  getIdentityByPuuid(puuid: string): Promise<RiotIdentity>;
  getSummonerByPuuid(puuid: string): Promise<RiotSummoner>;
  getSoloQueueSnapshot(puuid: string): Promise<RankedSoloSnapshot | null>;
  listMatchIds(input: MatchListInput): Promise<string[]>;
  getMatch(matchId: string): Promise<NormalizedMatch>;
  getTimeline(matchId: string): Promise<NormalizedTimeline>;
  getStaticData(gameVersion?: string): Promise<StaticDataSnapshot>;
}
