# 주간 미션 카탈로그 v1

이 문서는 1차 운영에 사용할 100개 미션 정의와 Riot Match-V5 판정 전략을 고정한다. 데이터 필드가 패치나 API 응답에 따라 누락될 수 있으므로 모든 evaluator는 `PASS | FAIL | PENDING_DATA | NOT_APPLICABLE`을 반환해야 한다. `PENDING_DATA`를 실패로 간주하지 않는다.

## 1. 공통 규칙

- 미션은 `MissionDefinition` 데이터로 저장하고 evaluator 코드는 registry에서 관리한다.
- `SINGLE`은 한 경기 단위, `CUMULATIVE`는 할당 활성 이후 여러 경기의 누적이다.
- 미션 판정 대상은 경기 시작 시 활성 상태였던 assignment snapshot으로 고정한다.
- 인정 경기 조건을 통과한 솔로 랭크 경기만 평가한다.
- 타임라인이 필요한 미션은 Match Timeline 조회 성공 후 판정한다. 타임라인 호출 실패 시 재시도 가능한 `PENDING_DATA`다.
- 타임라인 timestamp는 공용 변환 함수에서 millisecond를 second로 해석한다. `N초 이전`은 strict `< N초`이며 경계 시각의 이벤트는 포함하지 않는다.
- 10/15/20분 CS는 정확한 시각의 참가자 frame을 우선하고, 없으면 그 참가자를 포함한 가장 가까운 직전 frame을 사용한다. 목표 시각 전에 끝난 경기는 `FAIL`, 경기 시간은 충분하지만 안전 frame이 없으면 `PENDING_DATA`다.
- 아이템 이벤트는 timestamp 순으로 `ITEM_PURCHASED`, `ITEM_SOLD`, `ITEM_UNDO`를 재생한다. undo는 `beforeId`를 제거하고 `afterId`를 복구하며, M070은 120초 직전 inventory 원가에서 trinket을 제외한다.
- DDragon 데이터는 경기의 gameVersion과 가장 가까운 캐시 버전을 사용하고 사용한 버전을 기록한다.
- 누적 미션은 `MissionProgressEvent` signed delta로 재구성할 수 있어야 한다. distinct는 set semantics, 연승은 실제 경기 시작 시각 순서와 패배 reset을 사용하며 완료 원장은 assignment당 한 번만 생성한다.
- M100은 게시된 non-demo baseline으로 완료된 MVP/ACE award만 인정한다. pending 또는 demo 평가는 보상 근거가 아니다.
- 숫자는 정수 원본을 보존하고 비율 계산에서만 소수점을 사용한다. 경계값은 본 문서의 `이상/이하`를 그대로 포함한다.
- 포지션이 비어 있거나 비정상인 경우 포지션 미션은 `PENDING_DATA` 또는 운영 규칙에 따른 수동 검토로 보낸다.
- 점수는 난이도 기준 기본안이며, 시즌 시작 후에는 해당 주차 중 값을 바꾸지 않는다. 변경은 다음 주차용 정의 버전으로 게시한다.

## 2. 데이터 원천

| 값 | 의미 |
|---|---|
| `MATCH_INFO` | Match-V5 info/team/participant 필드만 필요 |
| `MATCH_TIMELINE` | Match Timeline event/frame 필요 |
| `DATA_DRAGON` | 정적 챔피언·아이템 분류 데이터 필요 |
| `DERIVED` | 정규화된 경기 데이터 또는 여러 경기에서 계산 |
| `INTERNAL` | 이 서비스가 산출한 MVP/ACE 등 내부 이벤트 |

## 3. 100개 정의

| 코드 | 미션 | 분류 | 유형 | 점수 | 목표 | Evaluator | 원천 | 판정 요약 |
|---|---|---|---:|---:|---|---|---|---|
| M001 | 승리 1회 | 결과 | SINGLE | 2 | `1` | `match.win` | MATCH_INFO | 활성 이후 시작된 인정 경기에서 1승 |
| M002 | KDA 3.0 이상 | 전투 | SINGLE | 2 | `3.0` | `combat.kdaAtLeast` | MATCH_INFO | (킬+어시스트)/max(1,데스) 3.0 이상 |
| M003 | KDA 5.0 이상 | 전투 | SINGLE | 3 | `5.0` | `combat.kdaAtLeast` | MATCH_INFO | KDA 5.0 이상 |
| M004 | KDA 8.0 이상 | 전투 | SINGLE | 4 | `8.0` | `combat.kdaAtLeast` | MATCH_INFO | KDA 8.0 이상 |
| M005 | 8킬 이상 | 전투 | SINGLE | 2 | `8` | `combat.killsAtLeast` | MATCH_INFO | 한 경기 8킬 이상 |
| M006 | 12킬 이상 | 전투 | SINGLE | 3 | `12` | `combat.killsAtLeast` | MATCH_INFO | 한 경기 12킬 이상 |
| M007 | 15킬 이상 | 전투 | SINGLE | 4 | `15` | `combat.killsAtLeast` | MATCH_INFO | 한 경기 15킬 이상 |
| M008 | 15어시스트 이상 | 전투 | SINGLE | 2 | `15` | `combat.assistsAtLeast` | MATCH_INFO | 한 경기 15어시스트 이상 |
| M009 | 25어시스트 이상 | 전투 | SINGLE | 4 | `25` | `combat.assistsAtLeast` | MATCH_INFO | 한 경기 25어시스트 이상 |
| M010 | 2데스 이하 승리 | 전투 | SINGLE | 3 | `2` | `combat.winWithDeathsAtMost` | MATCH_INFO | 승리하면서 2데스 이하 |
| M011 | 노데스 승리 | 전투 | SINGLE | 5 | `0` | `combat.winWithDeathsAtMost` | MATCH_INFO | 승리하면서 0데스 |
| M012 | 킬 관여율 60% | 전투 | SINGLE | 2 | `0.6` | `combat.killParticipationAtLeast` | MATCH_INFO | 팀 킬이 0이면 미달 처리 |
| M013 | 킬 관여율 75% | 전투 | SINGLE | 4 | `0.75` | `combat.killParticipationAtLeast` | MATCH_INFO | 팀 킬이 0이면 미달 처리 |
| M014 | 챔피언 피해 25,000 | 피해 | SINGLE | 2 | `25000` | `damage.toChampionsAtLeast` | MATCH_INFO | totalDamageDealtToChampions 기준 |
| M015 | 챔피언 피해 40,000 | 피해 | SINGLE | 4 | `40000` | `damage.toChampionsAtLeast` | MATCH_INFO | totalDamageDealtToChampions 기준 |
| M016 | 분당 챔피언 피해 800 | 피해 | SINGLE | 4 | `800` | `damage.perMinuteAtLeast` | DERIVED | 피해량/(게임초/60), 10분 미만 무효 경기 제외 |
| M017 | 받은 피해 35,000 | 피해 | SINGLE | 3 | `35000` | `damage.takenAtLeast` | MATCH_INFO | totalDamageTaken 기준 |
| M018 | 감소시킨 피해 30,000 | 피해 | SINGLE | 3 | `30000` | `damage.mitigatedAtLeast` | MATCH_INFO | damageSelfMitigated 기준 |
| M019 | 군중 제어 30초 | 전투 | SINGLE | 3 | `30` | `combat.ccTimeAtLeast` | MATCH_INFO | timeCCingOthers 기준 |
| M020 | 아군 회복·보호막 10,000 | 보호 | SINGLE | 3 | `10000` | `support.allyHealShieldAtLeast` | MATCH_INFO | totalHealsOnTeammates+totalDamageShieldedOnTeammates |
| M021 | CS 150개 | 성장 | SINGLE | 1 | `150` | `growth.csAtLeast` | MATCH_INFO | 미니언+중립 몬스터 처치 합 |
| M022 | CS 200개 | 성장 | SINGLE | 2 | `200` | `growth.csAtLeast` | MATCH_INFO | 미니언+중립 몬스터 처치 합 |
| M023 | 분당 CS 7.0 | 성장 | SINGLE | 2 | `7.0` | `growth.csPerMinuteAtLeast` | DERIVED | CS/(게임초/60) |
| M024 | 분당 CS 8.5 | 성장 | SINGLE | 4 | `8.5` | `growth.csPerMinuteAtLeast` | DERIVED | CS/(게임초/60) |
| M025 | 골드 15,000 | 성장 | SINGLE | 2 | `15000` | `growth.goldAtLeast` | MATCH_INFO | goldEarned 기준 |
| M026 | 시야 점수 40 | 시야 | SINGLE | 2 | `40` | `vision.scoreAtLeast` | MATCH_INFO | visionScore 기준 |
| M027 | 시야 점수 70 | 시야 | SINGLE | 3 | `70` | `vision.scoreAtLeast` | MATCH_INFO | visionScore 기준 |
| M028 | 시야 점수 100 | 시야 | SINGLE | 5 | `100` | `vision.scoreAtLeast` | MATCH_INFO | visionScore 기준 |
| M029 | 제어 와드 3개 구매 | 시야 | SINGLE | 2 | `3` | `vision.controlWardsBoughtAtLeast` | MATCH_INFO | visionWardsBoughtInGame 기준 |
| M030 | 와드 5개 제거 | 시야 | SINGLE | 2 | `5` | `vision.wardsKilledAtLeast` | MATCH_INFO | wardsKilled 기준 |
| M031 | 오브젝트 피해 20,000 | 오브젝트 | SINGLE | 3 | `20000` | `objective.damageAtLeast` | MATCH_INFO | damageDealtToObjectives 기준 |
| M032 | 포탑 피해 5,000 | 오브젝트 | SINGLE | 2 | `5000` | `objective.turretDamageAtLeast` | MATCH_INFO | damageDealtToTurrets 기준 |
| M033 | 18레벨 달성 | 성장 | SINGLE | 2 | `18` | `growth.levelAtLeast` | MATCH_INFO | champLevel 기준 |
| M034 | 한 번에 15분 생존 | 생존 | SINGLE | 3 | `900` | `combat.longestLifeAtLeast` | MATCH_INFO | longestTimeSpentLiving 초 기준 |
| M035 | 분당 골드 450 | 성장 | SINGLE | 3 | `450` | `growth.goldPerMinuteAtLeast` | DERIVED | goldEarned/(게임초/60) |
| M036 | 더블 킬 | 멀티킬 | SINGLE | 1 | `1` | `combat.doubleKillsAtLeast` | MATCH_INFO | doubleKills 1 이상 |
| M037 | 트리플 킬 | 멀티킬 | SINGLE | 3 | `1` | `combat.tripleKillsAtLeast` | MATCH_INFO | tripleKills 1 이상 |
| M038 | 쿼드라 킬 | 멀티킬 | SINGLE | 5 | `1` | `combat.quadraKillsAtLeast` | MATCH_INFO | quadraKills 1 이상 |
| M039 | 펜타 킬 | 멀티킬 | SINGLE | 8 | `1` | `combat.pentaKillsAtLeast` | MATCH_INFO | pentaKills 1 이상 |
| M040 | 5연속 킬 | 전투 | SINGLE | 3 | `5` | `combat.largestKillingSpreeAtLeast` | MATCH_INFO | largestKillingSpree 기준 |
| M041 | 솔로 킬 3회 | 전투 | SINGLE | 4 | `3` | `combat.soloKillsAtLeast` | MATCH_INFO | Challenges의 soloKills 사용; 필드 누락 시 판정 보류 |
| M042 | 퍼스트 블러드 관여 | 전투 | SINGLE | 2 | `1` | `combat.firstBloodParticipation` | MATCH_INFO | firstBloodKill 또는 firstBloodAssist |
| M043 | 퍼스트 타워 관여 | 오브젝트 | SINGLE | 2 | `1` | `objective.firstTowerParticipation` | MATCH_INFO | firstTowerKill 또는 firstTowerAssist |
| M044 | 포탑 철거 관여 3회 | 오브젝트 | SINGLE | 3 | `3` | `objective.turretTakedownsAtLeast` | MATCH_INFO | Challenges.turretTakedowns 우선, 없으면 킬/어시스트 필드 |
| M045 | 억제기 철거 관여 | 오브젝트 | SINGLE | 3 | `1` | `objective.inhibitorTakedownsAtLeast` | MATCH_INFO | inhibitorKills+inhibitorTakedowns/assist 정규화 |
| M046 | 드래곤 처치 관여 2회 | 오브젝트 | SINGLE | 3 | `2` | `objective.dragonTakedownsAtLeast` | MATCH_TIMELINE | 타임라인 ELITE_MONSTER_KILL의 killer/assistingParticipantIds |
| M047 | 바론 처치 관여 | 오브젝트 | SINGLE | 3 | `1` | `objective.baronTakedownsAtLeast` | MATCH_TIMELINE | 타임라인 BARON_NASHOR 처치 관여 |
| M048 | 전령 처치 관여 | 오브젝트 | SINGLE | 2 | `1` | `objective.heraldTakedownsAtLeast` | MATCH_TIMELINE | 타임라인 RIFTHERALD 처치 관여 |
| M049 | 오브젝트 스틸 | 오브젝트 | SINGLE | 5 | `1` | `objective.stealsAtLeast` | MATCH_INFO | objectivesStolen 1 이상 |
| M050 | 팀 드래곤 3회 | 오브젝트 | SINGLE | 3 | `3` | `objective.teamDragonsAtLeast` | MATCH_INFO | participant team의 objectives.dragon.kills |
| M051 | 바론 처치 후 승리 | 오브젝트 | SINGLE | 4 | `1` | `objective.winWithTeamBaron` | MATCH_INFO | 승리 팀의 바론 처치 1회 이상 |
| M052 | 25분 이내 승리 | 속도 | SINGLE | 4 | `1500` | `result.winWithinSeconds` | MATCH_INFO | gameDuration <= 1500초 |
| M053 | 15분 57초 이내 승리 | 속도 | SINGLE | 7 | `957` | `result.winWithinSeconds` | MATCH_INFO | gameDuration <= 957초 |
| M054 | 35분 이상 경기 승리 | 인내 | SINGLE | 3 | `2100` | `result.winAfterSeconds` | MATCH_INFO | gameDuration >= 2100초 |
| M055 | 용 2회·바론 1회와 승리 | 오브젝트 | SINGLE | 5 | `1` | `objective.winWithDragonsAndBaron` | MATCH_INFO | 승리+팀 드래곤>=2+바론>=1 |
| M056 | 5분 전 킬 | 타임라인 | SINGLE | 2 | `300` | `timeline.killBeforeSeconds` | MATCH_TIMELINE | 본인 CHAMPION_KILL timestamp < 300초 |
| M057 | 10분 전 3킬 | 타임라인 | SINGLE | 4 | `3` | `timeline.killsBeforeTenAtLeast` | MATCH_TIMELINE | 본인 킬 3회 이상을 600초 이전 달성 |
| M058 | 15분까지 무데스 | 타임라인 | SINGLE | 2 | `900` | `timeline.noDeathUntilSeconds` | MATCH_TIMELINE | 900초 전 CHAMPION_KILL victimId가 본인인 이벤트 없음 |
| M059 | 10분 CS 50 | 타임라인 | SINGLE | 2 | `50` | `timeline.csAtMinuteAtLeast` | MATCH_TIMELINE | 10분 프레임의 totalMinionsKilled+jungleMinionsKilled |
| M060 | 15분 CS 100 | 타임라인 | SINGLE | 3 | `100` | `timeline.csAtMinuteAtLeast` | MATCH_TIMELINE | 15분 프레임 기준 |
| M061 | 20분 CS 150 | 타임라인 | SINGLE | 4 | `150` | `timeline.csAtMinuteAtLeast` | MATCH_TIMELINE | 20분 프레임 기준 |
| M062 | 8분 전 제어 와드 구매 | 타임라인 | SINGLE | 2 | `480` | `timeline.controlWardPurchaseBefore` | MATCH_TIMELINE | ITEM_PURCHASED itemId=2055, timestamp < 480초 |
| M063 | 도란 시작 아이템 | 빌드 | SINGLE | 1 | `1` | `build.doranStart` | MATCH_TIMELINE | 첫 귀환 전 도란 계열 아이템 구매 |
| M064 | 서포트 퀘스트 시작 아이템 | 빌드 | SINGLE | 1 | `1` | `build.supportStart` | MATCH_TIMELINE | 첫 귀환 전 현재 패치 지원 아이템 시작 구성 구매 |
| M065 | 물약 미구매 | 빌드 | SINGLE | 2 | `0` | `build.noPotionPurchase` | MATCH_TIMELINE | 전체 타임라인에 허용된 물약 itemId 구매 이벤트 없음 |
| M066 | 점멸 없이 승리 | 빌드 | SINGLE | 4 | `0` | `build.winWithoutFlash` | MATCH_INFO | summoner spell 1/2에 Flash가 없고 승리 |
| M067 | 신발 없이 승리 | 빌드 | SINGLE | 4 | `0` | `build.winWithoutBoots` | MATCH_TIMELINE | 경기 종료 보유 및 구매 이력에서 신발 계열 없음 |
| M068 | 완성 아이템 3개 | 빌드 | SINGLE | 2 | `3` | `build.completedItemsAtLeast` | MATCH_INFO | DDragon item 분류로 완성 아이템 3개 이상 |
| M069 | 완성 아이템 4개 | 빌드 | SINGLE | 3 | `4` | `build.completedItemsAtLeast` | MATCH_INFO | DDragon item 분류로 완성 아이템 4개 이상 |
| M070 | 초반 구매 500골드 이하 | 빌드 | SINGLE | 3 | `500` | `build.startPurchaseCostAtMost` | MATCH_TIMELINE | 2분 전 구매 원가 합, 장신구 제외; 판매/되돌리기 반영 |
| M071 | 탑으로 승리 | 포지션 | SINGLE | 2 | `TOP` | `position.winAs` | MATCH_INFO | teamPosition 정규화 TOP |
| M072 | 정글로 승리 | 포지션 | SINGLE | 2 | `JUNGLE` | `position.winAs` | MATCH_INFO | teamPosition 정규화 JUNGLE |
| M073 | 미드로 승리 | 포지션 | SINGLE | 2 | `MIDDLE` | `position.winAs` | MATCH_INFO | teamPosition 정규화 MIDDLE |
| M074 | 원딜로 승리 | 포지션 | SINGLE | 2 | `BOTTOM` | `position.winAs` | MATCH_INFO | teamPosition 정규화 BOTTOM |
| M075 | 서포터로 승리 | 포지션 | SINGLE | 2 | `UTILITY` | `position.winAs` | MATCH_INFO | teamPosition 정규화 UTILITY |
| M076 | 주 포지션 외 승리 | 포지션 | SINGLE | 3 | `1` | `position.winOffPrimary` | DERIVED | Participant.primaryPosition과 다른 유효 포지션으로 승리 |
| M077 | 정밀 룬으로 승리 | 룬 | SINGLE | 2 | `8000` | `rune.winWithPrimaryStyle` | MATCH_INFO | primaryStyle ID 8000 |
| M078 | 지배 룬으로 승리 | 룬 | SINGLE | 2 | `8100` | `rune.winWithPrimaryStyle` | MATCH_INFO | primaryStyle ID 8100 |
| M079 | 마법 룬으로 승리 | 룬 | SINGLE | 2 | `8200` | `rune.winWithPrimaryStyle` | MATCH_INFO | primaryStyle ID 8200 |
| M080 | 결의 룬으로 승리 | 룬 | SINGLE | 2 | `8400` | `rune.winWithPrimaryStyle` | MATCH_INFO | primaryStyle ID 8400 |
| M081 | 영감 룬으로 승리 | 룬 | SINGLE | 2 | `8300` | `rune.winWithPrimaryStyle` | MATCH_INFO | primaryStyle ID 8300 |
| M082 | 탱커 챔피언으로 승리 | 챔피언 | SINGLE | 2 | `Tank` | `champion.winWithTag` | DATA_DRAGON | 현재 경기 패치와 매핑된 champion tag |
| M083 | 전사 챔피언으로 승리 | 챔피언 | SINGLE | 2 | `Fighter` | `champion.winWithTag` | DATA_DRAGON | 현재 경기 패치와 매핑된 champion tag |
| M084 | 마법사 챔피언으로 승리 | 챔피언 | SINGLE | 2 | `Mage` | `champion.winWithTag` | DATA_DRAGON | 현재 경기 패치와 매핑된 champion tag |
| M085 | 원거리 딜러 챔피언으로 승리 | 챔피언 | SINGLE | 2 | `Marksman` | `champion.winWithTag` | DATA_DRAGON | 현재 경기 패치와 매핑된 champion tag |
| M086 | 경기 3회 플레이 | 누적 | CUMULATIVE | 2 | `3` | `cumulative.games` | DERIVED | 활성 이후 인정 경기 3회 |
| M087 | 경기 5회 플레이 | 누적 | CUMULATIVE | 3 | `5` | `cumulative.games` | DERIVED | 활성 이후 인정 경기 5회 |
| M088 | 2승 달성 | 누적 | CUMULATIVE | 2 | `2` | `cumulative.wins` | DERIVED | 활성 이후 2승 |
| M089 | 4승 달성 | 누적 | CUMULATIVE | 4 | `4` | `cumulative.wins` | DERIVED | 활성 이후 4승 |
| M090 | 3연승 달성 | 누적 | CUMULATIVE | 4 | `3` | `cumulative.winStreak` | DERIVED | 활성 이후 연속 승리 3회; 패배 시 진행 연속값 초기화 |
| M091 | 누적 20킬 | 누적 | CUMULATIVE | 2 | `20` | `cumulative.kills` | DERIVED | 활성 이후 킬 합계 |
| M092 | 누적 50어시스트 | 누적 | CUMULATIVE | 3 | `50` | `cumulative.assists` | DERIVED | 활성 이후 어시스트 합계 |
| M093 | 누적 CS 600 | 누적 | CUMULATIVE | 3 | `600` | `cumulative.cs` | DERIVED | 활성 이후 CS 합계 |
| M094 | 누적 시야 점수 150 | 누적 | CUMULATIVE | 3 | `150` | `cumulative.visionScore` | DERIVED | 활성 이후 visionScore 합계 |
| M095 | 누적 챔피언 피해 100,000 | 누적 | CUMULATIVE | 4 | `100000` | `cumulative.damageToChampions` | DERIVED | 활성 이후 피해 합계 |
| M096 | 서로 다른 챔피언 5명 | 누적 | CUMULATIVE | 4 | `5` | `cumulative.distinctChampions` | DERIVED | 활성 이후 championId distinct count |
| M097 | 서로 다른 포지션 3개 | 누적 | CUMULATIVE | 4 | `3` | `cumulative.distinctPositions` | DERIVED | 유효 teamPosition distinct count |
| M098 | 누적 제어 와드 10개 | 누적 | CUMULATIVE | 3 | `10` | `cumulative.controlWardsBought` | DERIVED | 활성 이후 구매 합계 |
| M099 | 팀 드래곤 누적 8회 | 누적 | CUMULATIVE | 4 | `8` | `cumulative.teamDragons` | DERIVED | 활성 이후 참가 팀 드래곤 처치 합 |
| M100 | MVP 또는 ACE 1회 | 누적 | CUMULATIVE | 5 | `1` | `cumulative.mvpAceAwards` | INTERNAL | 게시된 실데이터 기준 평가에서 MVP/ACE 획득 |

## 4. 활성 풀과 난이도 가드레일

기본적으로 100개를 모두 게시할 수 있으나, 주차별 `eligibleRoles`, `minDuration`, `requiresTimeline`, `requiresPublishedMvpBaseline` 조건을 적용한다. 다음 규칙을 권장한다.

- 한 참가자의 최초 5개에 5점 이상 미션은 최대 1개다.
- 최초 5개 중 최소 1개는 1~2점의 일반 미션이다.
- 역할 제한 미션은 해당 참가자의 주 포지션만 강제하지 않되, 동일 포지션 미션이 동시에 두 개 이상 활성화되지 않게 한다.
- 타임라인 의존 미션은 동시에 최대 2개다.
- 누적 미션은 동시에 최대 2개다.
- `M100`은 실제 게시된 MVP 기준 버전이 없으면 후보 풀에서 제외한다.
- 패치 변경으로 evaluator가 안정적이지 않으면 해당 정의를 `DISABLED`로 게시하고 대체 미션을 사용한다.

## 5. 난수 배정

미션 배정은 서버의 안전한 난수를 사용하되, 운영 감사가 가능하도록 assignment의 `selectionSeedHash`, 후보 정의 버전, 선택된 mission ID를 기록한다. 사용자가 후보를 예측하거나 클라이언트에서 다시 뽑을 수 없어야 한다. 동일한 정의를 같은 참가자·주차에 중복 활성화하지 않는다.

## 6. 진행도 저장

- `currentValue`, `targetValue`, `unit`, `lastEvaluatedMatchId`를 저장한다.
- distinct 기반 미션은 단순 숫자뿐 아니라 중복 제거용 별도 progress payload 또는 event ledger를 유지한다.
- 연승은 현재 연속값과 최대 연속값을 분리한다.
- 완료 시 `MissionCompletionLedger`를 한 번만 생성하고 주간 미션 점수 read model에 반영한다.
- 재처리 시 동일 `(assignmentId, matchId, evaluatorVersion)`은 한 번만 반영한다.

## 7. 관리자 편집 제한

관리자는 새 버전의 미션 정의를 만들 수 있지만 진행 중인 주차의 정의를 직접 덮어쓰지 않는다. 오판정 정정은 사유와 함께 correction event를 추가하고 AuditLog를 남긴다. evaluator 코드가 없는 임의 표현식을 운영 UI에서 실행하지 않는다.

## 8. 출시 전 fixture

각 evaluator는 최소 다음 fixture를 가진다.

- 정확히 경계값인 성공 사례
- 경계보다 1 작은 실패 사례
- 데이터 필드 누락 사례
- 10분 미만 또는 무효 큐 사례
- 타임라인 이벤트 순서가 뒤섞인 사례
- 동일 경기를 두 번 처리한 사례
- 누적 미션이 활성되기 전 경기와 후 경기의 혼합 사례
- 경기 도중 리롤되어 snapshot과 현재 assignment가 다른 사례
