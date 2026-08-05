export type PublicReadResult<T> =
  { state: "ready"; data: T } | { state: "empty" } | { state: "unavailable" };

export type StandingRow = {
  id: string;
  participantWeekId: string;
  rank: number;
  previousRank: number;
  gameName: string;
  tagLine: string;
  realName: string | null;
  score: number;
  wins: number;
  losses: number;
  tier: string;
  division: string;
  lp: number;
  startLpDelta: number;
  comparisonLpDelta: number;
  comparisonDate: string | null;
  currentRankDate: string | null;
  streak: number;
  sealed: number;
  recent: Array<"W" | "L">;
};

export type MatchPosition = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

export type MatchPointDetail = {
  state:
    "MISSING" | "SEALED" | "REVEALED" | "REROLLED" | "AUTO_REVEALED" | "VOID";
  signedPoint: number | null;
  drawId: string | null;
  phase: "FIRST" | "SECOND" | null;
  magnitude: number | null;
  nonce: string | null;
  commitment: string | null;
  commitmentVersion: string | null;
  rngVersion: string | null;
  pointMode: "RANDOM_17_23" | "FIXED_20" | null;
  generatedAt: string | null;
  revealedAt: string | null;
  autoRevealed: boolean;
  rerolled: boolean;
  verification: "UNAVAILABLE" | "PENDING" | "VERIFIED" | "FAILED" | "VOID";
  verifier: {
    algorithm: string;
    encoding: string;
    fields: string[];
    probability: string;
  } | null;
};

export type MatchMvpDetail = {
  award: "MVP" | "ACE" | null;
  totalScore: number | null;
  teamRank: number | null;
  position: MatchPosition | null;
  evaluatorVersion: string;
  baseline: {
    name: string;
    patchFrom: string;
    patchTo: string;
    demoOnly: boolean;
  } | null;
  groups: Array<{
    key: "VISION_OBJECTIVE" | "GROWTH" | "DAMAGE" | "KDA_PARTICIPATION";
    label: string;
    score: number | null;
    weight: number | null;
  }>;
};

export type MatchMissionProgress = {
  assignmentId: string;
  code: string;
  title: string;
  before: number;
  delta: number;
  after: number;
  target: number;
  unit: string | null;
  completed: boolean;
  correction: boolean;
  evaluatorVersion: string;
};

export type MatchSummary = {
  id: string;
  riotMatchId: string;
  participantId: string;
  gameName: string;
  tagLine: string;
  champion: string;
  position: MatchPosition | null;
  role: string;
  result: "승" | "패";
  kda: string;
  cs: number;
  duration: string;
  endedAt: string;
  endedAtIso: string;
  point: number | null;
  streak: number;
  invalid: boolean;
  invalidReason: "ADMIN_INVALIDATED" | null;
  award?: "MVP" | "ACE";
  details: {
    point: MatchPointDetail;
    mvp: MatchMvpDetail | null;
    missions: MatchMissionProgress[];
  };
};

export type SeasonContext = {
  id: string;
  name: string;
  eventName: string;
  status: string;
  startAt: string;
  endAt: string;
  rulesVersion: string;
  scoringMode: "RANDOM_17_23" | "FIXED_20";
  minGameDurationSeconds: number;
  autoRevealHours: number;
};

export type WeekContext = {
  id: string;
  number: number;
  name: string;
  status: string;
  startAt: string;
  endAt: string;
  finalized: boolean;
};

export type LeaderboardData = {
  season: SeasonContext;
  week: WeekContext;
  weeks: WeekContext[];
  standings: StandingRow[];
  summary: {
    participants: number;
    matches: number;
    sealed: number;
    averageWinRate: number;
  };
  freshness: {
    lastSuccessAt: string | null;
    stale: boolean;
  };
};

export type HomeDashboardData = {
  leaderboard: LeaderboardData;
  topFive: StandingRow[];
  recentMatches: MatchSummary[];
  highlights: {
    lp: { participant: StandingRow | null; value: number; label: string };
    streak: { participant: StandingRow | null; value: number };
    games: { participant: StandingRow | null; value: number; label: string };
  };
  missionLeaders: Array<{
    participantWeekId: string;
    rank: number;
    gameName: string;
    tagLine: string;
    score: number;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    publishedAt: string;
    pinned: boolean;
  }>;
};

export type ProgressPoint = {
  date: string;
  label: string;
  score: number | null;
  lp: number | null;
};

export type ParticipantProfileData = {
  standing: StandingRow;
  season: SeasonContext;
  week: WeekContext;
  lastSyncedAt: string | null;
  startRank: { tier: string; division: string; lp: number } | null;
  scoreSeries: ProgressPoint[];
  matches: MatchSummary[];
  champions: Array<{
    champion: string;
    games: number;
    wins: number;
    averageKda: number;
  }>;
  positions: Array<{ position: string; games: number; percentage: number }>;
  awards: { mvp: number; ace: number };
  completedMissions: Array<{
    id: string;
    code: string;
    title: string;
    points: number;
    completedAt: string | null;
  }>;
  ledger: Array<{
    id: string;
    type: string;
    amount: number;
    createdAt: string;
  }>;
};

export type MatchesData = {
  season: SeasonContext;
  week: WeekContext;
  rows: MatchSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type HistoryStanding = {
  rank: number;
  participantId: string | null;
  gameName: string;
  tagLine: string;
  realName: string | null;
  score: number;
  wins: number;
  losses: number;
  completed: number;
};

export type HistoryEntry = {
  id: string;
  kind: "WEEK" | "FINAL";
  seasonName: string;
  label: string;
  startAt: string;
  endAt: string;
  generatedAt: string;
  rulesVersion: string;
  checksum: string;
  standings: HistoryStanding[];
  missionStandings: HistoryStanding[];
};
