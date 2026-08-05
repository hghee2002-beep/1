const objective = (kills: number, first = false) => ({ kills, first });

export function createRawMatch(matchId = "KR_TEST_001") {
  const participants = Array.from({ length: 10 }, (_, index) => {
    const participantId = index + 1;
    const teamId = participantId <= 5 ? 100 : 200;
    const position = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"][
      index % 5
    ];
    return {
      participantId,
      puuid: `PUUID_${participantId}`,
      teamId,
      teamPosition: position,
      championId: 100 + participantId,
      championName: `Champion${participantId}`,
      champLevel: 16,
      win: teamId === 100,
      kills: participantId,
      deaths: 2,
      assists: 10,
      totalMinionsKilled: 180,
      neutralMinionsKilled: position === "JUNGLE" ? 90 : 5,
      goldEarned: 15_000,
      totalDamageDealtToChampions: 25_000,
      totalDamageTaken: 22_000,
      damageSelfMitigated: 18_000,
      damageDealtToObjectives: 20_000,
      damageDealtToTurrets: 5_500,
      visionScore: 45,
      wardsPlaced: 12,
      wardsKilled: 4,
      visionWardsBoughtInGame: 3,
      timeCCingOthers: 32,
      totalHealsOnTeammates: position === "UTILITY" ? 6_000 : 0,
      totalDamageShieldedOnTeammates: position === "UTILITY" ? 5_000 : 0,
      doubleKills: 1,
      tripleKills: 0,
      quadraKills: 0,
      pentaKills: 0,
      largestKillingSpree: 5,
      firstBloodKill: participantId === 1,
      firstBloodAssist: false,
      firstTowerKill: participantId === 1,
      firstTowerAssist: participantId === 2,
      inhibitorKills: 1,
      inhibitorTakedowns: 1,
      objectivesStolen: 0,
      detectorWardsPlaced: 3,
      longestTimeSpentLiving: 930,
      item0: 1055,
      item1: 3006,
      item2: 3031,
      item3: 0,
      item4: 0,
      item5: 0,
      item6: 3340,
      perks: {
        styles: [
          { style: 8000, selections: [{ perk: 8005 }, { perk: 9111 }] },
          { style: 8200, selections: [{ perk: 8233 }] },
        ],
      },
      summoner1Id: 4,
      summoner2Id: 14,
      gameEndedInEarlySurrender: false,
      gameEndedInSurrender: false,
      timePlayed: 1_800,
      challenges: {
        soloKills: 3,
        turretTakedowns: 4,
        inhibitorTakedowns: 1,
        objectivesStolen: 0,
        controlWardsPlaced: 3,
        longestTimeSpentLiving: 930,
      },
    };
  });
  return {
    metadata: {
      dataVersion: "2",
      matchId,
      participants: participants.map((participant) => participant.puuid),
    },
    info: {
      gameDuration: 1_800,
      gameEndTimestamp: 1_754_020_600_000,
      gameMode: "CLASSIC",
      gameStartTimestamp: 1_754_018_800_000,
      gameType: "MATCHED_GAME",
      gameVersion: "16.15.1.7028314",
      mapId: 11,
      platformId: "KR",
      queueId: 420,
      participants,
      teams: [
        {
          teamId: 100,
          win: true,
          objectives: {
            baron: objective(1, true),
            champion: objective(30),
            dragon: objective(3, true),
            inhibitor: objective(2, true),
            riftHerald: objective(1, true),
            tower: objective(9, true),
          },
        },
        {
          teamId: 200,
          win: false,
          objectives: {
            baron: objective(0),
            champion: objective(18),
            dragon: objective(1),
            inhibitor: objective(0),
            riftHerald: objective(0),
            tower: objective(3),
          },
        },
      ],
    },
  };
}

export function createRawTimeline(matchId = "KR_TEST_001") {
  const participantFrames = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [
      String(index + 1),
      {
        participantId: index + 1,
        level: 10,
        currentGold: 500,
        totalGold: 6_000,
        minionsKilled: 80,
        jungleMinionsKilled: index === 1 ? 60 : 0,
        xp: 7_000,
      },
    ]),
  );
  return {
    metadata: { dataVersion: "2", matchId },
    info: {
      frameInterval: 60_000,
      participants: Array.from({ length: 10 }, (_, index) => ({
        participantId: index + 1,
        puuid: `PUUID_${index + 1}`,
      })),
      frames: [
        {
          timestamp: 600_000,
          participantFrames,
          events: [
            {
              type: "ELITE_MONSTER_KILL",
              timestamp: 540_000,
              killerId: 2,
              assistingParticipantIds: [1, 3],
              monsterType: "DRAGON",
              monsterSubType: "FIRE_DRAGON",
            },
            {
              type: "CHAMPION_KILL",
              timestamp: 240_000,
              killerId: 1,
              victimId: 6,
              assistingParticipantIds: [2],
            },
          ],
        },
      ],
    },
  };
}

export const dataDragonFixtures = {
  champions: {
    data: {
      Ahri: {
        id: "Ahri",
        key: "103",
        name: "아리",
        title: "구미호",
        tags: ["Mage", "Assassin"],
        image: { full: "Ahri.png" },
      },
    },
  },
  items: {
    data: {
      "2055": {
        name: "제어 와드",
        description: "시야를 밝힙니다.",
        tags: ["Vision", "Consumable"],
        gold: { total: 75, purchasable: true },
        image: { full: "2055.png" },
      },
    },
  },
  runes: [
    {
      id: 8000,
      key: "Precision",
      name: "정밀",
      icon: "perk-images/Styles/7201_Precision.png",
      slots: [
        {
          runes: [
            {
              id: 8005,
              key: "PressTheAttack",
              name: "집중 공격",
              icon: "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png",
            },
          ],
        },
      ],
    },
  ],
};
