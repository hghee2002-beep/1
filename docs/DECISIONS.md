# 확정 설계 결정

이 문서는 서로 충돌하거나 구현 전에 명확히 해야 했던 규칙을 운영 가능한 형태로 고정한다.

## D-001. 서비스 범위

- 기본 참가 규모: 약 20명
- 기본 이벤트: 1주 또는 연속된 2개 주차
- 이벤트·주차 시간대: `Asia/Seoul`
- 기본 언어: 한국어
- 경기 수 제한: 없음
- 인정 경기: 이벤트 기간 안에 시작된 `RANKED_SOLO_5x5` 경기
- 기본 Queue ID는 현재 공식 상수에서 확인해 설정하며 코드에 의미 없는 숫자를 흩뿌리지 않는다.
- 조기 종료·무효 경기 기준은 관리자가 설정할 수 있고 기본 최소 경기 시간은 10분이다.

## D-002. 메인 순위

메인 점수는 경기마다 승리 시 `+17~+23`, 패배 시 `-17~-23` 중 하나를 동일 확률로 적용한 합계다.

정렬 순서:

1. 메인 점수 내림차순
2. 순수 승패 차(`wins - losses`) 내림차순
3. 승리 수 내림차순
4. 모두 같으면 공동 순위

공동 순위는 competition ranking을 사용한다. 예: `1, 1, 3`.

## D-003. 포인트 추첨의 공정성과 공개 시점

- 결과는 클라이언트의 `Math.random()`으로 정하지 않는다.
- 서버에서 암호학적으로 안전한 균등 난수로 17~23을 생성한다.
- 경기 처리 시 첫 결과를 미리 생성하고 해시 commitment를 저장한다.
- 점수는 경기 처리 트랜잭션에서 즉시 원장에 반영한다. 사용자가 공개 화면을 늦게 열어도 순위가 왜곡되지 않는다.
- 사용자의 버튼은 “결과 생성”이 아니라 “봉인 결과 공개” 역할을 한다.
- 공개 전 API 응답에는 실제 숫자와 nonce를 포함하지 않는다.
- 공개 시 숫자와 nonce를 제공해 commitment를 검증할 수 있다.
- 각 값의 확률은 `1/7`로 공개한다.
- 기본 자동 공개 시간은 경기 반영 후 12시간이며 관리자 설정 가능하다.
- 현금·유료 재추첨·환전·베팅은 없다.
- 정책 검토에 따라 `FIXED_20` 모드로 즉시 전환할 수 있다.

## D-004. MVP/ACE 재추첨

- 한 경기의 승리 팀 최고 평가 참가자는 MVP, 패배 팀 최고 평가 참가자는 ACE다.
- 추적 중인 대회 참가자가 해당 팀의 최고 평가자일 때만 재추첨권을 받는다.
- 재추첨은 선택 사항이다.
- 재추첨을 실행하면 두 번째 결과가 무조건 최종이다. 첫 결과로 되돌릴 수 없다.
- 재추첨 전 확인 화면에서 이 규칙을 명시한다.
- 두 번째 값은 첫 값과 같을 수 있다.
- 재추첨 시 점수 원장에는 기존 행 수정이 아니라 차이값 조정 행을 추가한다.
- 기본 사용 기한은 해당 주차 종료 전까지다.
- 관리자는 기한을 변경할 수 있으나 이미 종료된 결과를 은밀히 바꾸지 못한다.

## D-005. MVP/ACE 기준 데이터

- 포지션: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
- 티어 버킷: PLATINUM, EMERALD, DIAMOND, MASTER_PLUS
- 기준 데이터는 평균, 표준편차, 표본 수, 패치 범위, 수집일, 버전을 포함한다.
- 실제 데이터가 없는 개발 환경에서는 명시적으로 `DEMO_ONLY`인 fixture를 사용한다.
- 프로덕션에서 `DEMO_ONLY` 기준으로 보상을 지급하는 기능은 기본 차단한다.
- 기준 데이터는 관리자 CSV/JSON 업로드 후 검증·게시한다.
- 과거 경기는 당시 사용한 기준 버전을 유지한다.

## D-006. MVP/ACE 계산

공통 70%:

- 시야·오브젝트 그룹 17.5%
- 골드·CS·분당 성장 그룹 17.5%
- 가한·받은 피해 그룹 17.5%
- KDA·킬 관여 그룹 17.5%

포지션 보정 30%:

- TOP: 피해/탱킹 15%, 성장 10%, KDA 5%
- JUNGLE: 시야/오브젝트 15%, KDA 10%, 피해 5%
- MIDDLE: 피해 15%, 성장 10%, KDA 5%
- BOTTOM: 피해 15%, 성장 10%, KDA 5%
- UTILITY: 시야/오브젝트 15%, KDA 10%, 피해/보호 5%

세부 지표는 동일 그룹 안에서 평균한다. 모든 z-score는 기본 `[-3, 3]` 범위로 winsorize한다.

동점 우선순위:

1. 총 평가 점수
2. KDA·킬 관여 그룹
3. 오브젝트 관여
4. 적은 사망
5. 결정론적 participant key

## D-007. 주간 미션

- 주차 시작 시 개인별 5개 활성 미션을 지급한다.
- 같은 주차에서 완료한 미션은 다시 등장하지 않는다.
- 리롤한 미션은 후순위 보관함으로 이동한다.
- 아직 한 번도 본 적 없는 활성 가능 미션이 남아 있으면 리롤 미션은 재등장하지 않는다.
- 미확인 미션을 모두 소진한 경우에만 리롤 미션이 다시 후보가 될 수 있다.
- 새 주차가 시작되면 주차 단위 상태를 초기화한다. 이벤트 전체 무반복 옵션은 관리자 설정으로 제공한다.
- 완료로 빈 슬롯이 생기면 보충 크레딧이 있을 때 즉시 채운다.
- 보충 크레딧은 주차 시작 시각을 기준으로 6시간마다 1개, 최대 3개까지 누적된다.
- 리롤은 1시간 쿨타임이며 즉시 다음 미션으로 교체한다. 보충 크레딧을 소비하지 않는다.
- 경기 시작 시각에 활성 상태였던 미션만 해당 경기로 평가한다.
- 경기 중 새로 활성된 미션은 그 경기에 적용하지 않는다.
- 경기 중 리롤한 경우에도 경기 시작 당시 활성 미션이 그 경기 판정 대상이다.
- 한 경기에서 여러 미션을 동시에 완료할 수 있다.
- 누적형 미션은 활성된 뒤 시작된 경기만 집계한다.
- 모든 진행도는 정확한 수치로 저장하고 표시한다.

## D-008. 회원가입과 Riot 계정

- 초기 버전은 사이트 자체 `loginId + password` 회원가입을 사용한다.
- 비밀번호는 Argon2id로 해시한다.
- 사이트 로그인과 Riot 계정 연결은 별개다.
- 사용자는 Riot ID의 `gameName`과 `tagLine`을 제출한다.
- 서버가 Riot ID를 PUUID로 변환해 검증한다.
- 관리자 승인 후 Participant가 된다.
- PUUID는 참가자 고유 식별자의 기준이다.
- Riot ID 변경은 PUUID로 추적해 갱신한다.
- RSO는 승인된 Production 앱과 별도 요구사항이 생길 때 추가하는 후속 기능이다.

## D-009. 준실시간의 의미

- 이 서비스는 게임 중 행동을 실시간 감시하지 않는다.
- Match-V5 데이터가 제공된 뒤 자동 판정한다.
- 목표 반영 시간은 경기 종료 후 수 분 이내다.
- 무료 스케줄러는 지연될 수 있어 SLA를 보장하지 않는다.
- 화면 데이터는 15~30초 간격 폴링과 사용자 행동 후 재검증으로 갱신한다.
- 서버리스 WebSocket을 기본 의존성으로 도입하지 않는다.

## D-010. 동기화 배포 모드

- `MANUAL`: 관리자 또는 제한된 기회성 동기화
- `GITHUB_SCHEDULE`: 서명된 엔드포인트를 예약 워크플로가 호출
- `VERCEL_CRON`: 유료 플랜 또는 허용 주기에 맞춘 Vercel Cron
- `WORKER`: 별도 지속 실행 워커

모든 모드는 같은 idempotent sync service를 호출한다.

## D-011. UI 원칙

- 실제 대형 스포츠·전적 서비스의 정보 위계와 밀도를 참고하되 화면을 복제하지 않는다.
- 과도한 그라디언트, 유리 효과, 둥근 카드 남발, 의미 없는 큰 여백을 피한다.
- 어두운 graphite 기반, 제한적인 전광판 glow, 명확한 승패 색상, 높은 데이터 가독성을 사용한다.
- 순위표는 순위와 Riot ID 열을 고정한다.
- 가로 스크롤이 발생한 뒤에만 경계 그림자를 표시한다.
- Riot ID는 먼저 글자 크기를 줄이고, 그래도 넘치면 셀 폭을 확장한다.
- 태그라인은 항상 표시한다.
- 모바일에서는 핵심 열을 보존하고 부가 정보는 행 확장 패널로 이동한다.
- 움직임 감소 설정을 존중한다.

## D-012. 포인트 공개 연출

- 카지노·슬롯머신·현금성 이미지를 사용하지 않는다.
- 콘셉트는 “랭크 신호 해독/봉인 해제”다.
- 기본 연출 길이: 약 4.8초
- 1.5초 뒤 건너뛰기 허용
- 소리는 기본 꺼짐
- `prefers-reduced-motion`에서는 약 0.4초의 단순 공개
- 최종 숫자는 서버 결과와 항상 일치
- 애니메이션 실패가 정산 실패로 이어지지 않음
- 재접속해도 같은 결과를 다시 확인 가능

## D-013. 관리자 수정

- 직접 DB 행을 임의 수정하는 UI를 만들지 않는다.
- 점수 수정은 사유가 포함된 `ADMIN_ADJUSTMENT` 원장 행으로 처리한다.
- 경기 무효화도 원본 삭제 대신 반전 원장과 상태 변경을 사용한다.
- 모든 관리자 작업은 AuditLog에 남긴다.
- 하드 삭제는 개발 fixture 외에는 사용하지 않는다.

## D-014. 미래 기능

다음은 현재 스키마에서 확장 가능하게만 설계하고 초기 운영 범위에서는 제외한다.

- 전적검색 사이트 수준의 임의 플레이어 검색
- 팀전·경매·코인 상점·슬롯 미니게임
- 실시간 관전 데이터
- Riot Sign On
- 푸시 알림
- 다국어

## D-015. Riot 정책 절차의 분리

- Riot API를 사용하는 공개 제품의 등록·키 승인은 Riot Developer Portal 절차로 관리한다.
- 대회 자체의 개최 조건은 최신 LoL Esports Community Competition Guidelines로 관리한다.
- 커뮤니티 대회 가이드의 적용 범위·사전 절차·제출 양식은 개최 직전 접근 가능한 공식 원문으로 확인하며, 2026-08-04 감사의 보수적 기준은 D-022를 따른다.
- 약 20명은 제품 목표 규모다. 정책 최소 인원 판단은 D-022의 최신 공식 확인 결과를 따른다.
- 이벤트와 사이트는 Riot Games·LoL Esports의 공식 주최·승인·후원으로 오인되지 않게 한다.
- Riot Games 로고 및 공식 esports 대회 상표는 사용하지 않는다.
- 금지 스폰서 범주, 운영자 적용 제외 범주, 자산 사용 조건은 개최 직전 최신 원문으로 다시 확인한다.
- chance-based scoring은 별도 정책·법률 검토 대상이며 불확실하면 `POINT_MODE=FIXED_20`을 사용한다.

## D-016. 경기 원본과 시즌 정산의 유일성 범위

- 배경: `Match.riotMatchId`는 전역 원본 식별자이지만, 요구사항의 정산 불변식은 `season + Riot match ID` 범위다. 기존 `ParticipantMatch(participantId, matchId)`만으로는 겹치는 시즌의 귀속을 표현할 수 없다.
- 결정: 원본 `Match`는 `riotMatchId`로 전역 유일하게 유지하고, `SeasonMatch(seasonId, matchId)` 연결을 추가해 시즌별 처리 상태를 보유한다. `SeasonMatch`는 `(seasonId, matchId)`가 유일하며, `ParticipantMatch`는 `(participantId, seasonMatchId)`가 유일하다. 주차는 경기 시작 시각이 속한 `[startAt, endAt)`으로 결정한다.
- 대안과 기각 이유: 활성 시즌을 항상 하나로 제한하면 단순하지만 과거 데이터 이관·운영 리허설·겹치는 테스트 시즌을 불필요하게 막는다. 원본 `Match`를 시즌마다 복제하면 raw payload와 정규화 결과가 중복된다.
- 데이터/마이그레이션 영향: 세션 02에서 `SeasonMatch`와 관련 foreign key/index를 최초 migration에 포함한다. 기존 데이터가 생긴 뒤 도입할 경우 `ParticipantWeek.weekId → Week.seasonId`로 backfill하고 중복을 먼저 보고한다.

## D-017. 미션 정의와 판정 이벤트의 버전 유일성

- 배경: 진행 중 정의를 덮어쓰지 않는다는 규칙과 `MissionDefinition.code unique`가 충돌했고, evaluator 재현 키에는 version이 필요하다.
- 결정: 미션 정의는 `(code, version)`이 유일하며 assignment가 정확한 definition ID와 evaluator version을 고정한다. 정상 판정 이벤트는 `(assignmentId, participantMatchId, evaluatorVersion)`이 유일하다. 다른 evaluator version으로 재평가할 때는 일반 처리 경로가 아니라 사유·AuditLog·`supersedesEventId`가 있는 correction event를 만들고, delta는 기존 결과와 새 결과의 차이만 반영한다.
- 대안과 기각 이유: code를 전역 unique로 유지하고 행을 수정하면 과거 주차 재현성이 깨진다. 새 version의 전체 delta를 다시 더하면 진행도가 중복된다.
- 데이터/마이그레이션 영향: `MissionDefinition` 복합 unique, `MissionProgressEvent` 복합 unique와 correction metadata가 필요하다. 기존 unique가 있다면 중복/버전 backfill 후 교체한다.

## D-018. 종료 스냅샷의 두 수준

- 배경: 문서에는 `WeekSnapshot`과 `FinalStandingSnapshot`이 함께 등장하지만 데이터 모델에는 주차 스냅샷만 있었다.
- 결정: `WeekSnapshot`은 주차별 최종 메인·미션 순위, `FinalStandingSnapshot`은 시즌 전체 최종 순위와 모든 주차 참조를 보존한다. 둘 다 대상당 하나이며 immutable이다. 한 주 시즌도 두 스냅샷을 각각 만든다.
- 대안과 기각 이유: 하나의 JSON 모델로 두 수준을 혼합하면 2주 시즌의 주차 기록과 시즌 최종 결과를 구분하기 어렵다.
- 데이터/마이그레이션 영향: 세션 02 최초 migration에 `FinalStandingSnapshot(seasonId unique)`를 추가한다. finalize는 두 스냅샷을 idempotent하게 생성한다.

## D-019. 포인트 commitment 정규형

- 배경: 아키텍처 예시는 version을 제외했지만 테스트 명세와 세션 08은 commitment version을 요구한다.
- 결정: v1 commitment는 `commitmentVersion`, `drawId`, `magnitude`, `nonce`를 모호하지 않은 length-prefixed canonical encoding으로 직렬화한 뒤 SHA-256으로 해시한다. 승패 부호는 immutable한 `ParticipantMatch.win`과 `PointDraw.resultSign` 제약으로 결합한다. canonical test vector를 저장하며 공개 전 nonce는 일반 select, 로그, 오류 응답에서 제외한다.
- 대안과 기각 이유: 구분자 문자열 결합은 필드 escaping과 향후 버전 변경에서 모호할 수 있고, version을 제외하면 검증 규칙을 안전하게 진화시키기 어렵다.
- 데이터/마이그레이션 영향: `commitmentVersion`과 RNG version을 명시적으로 저장한다. 보호된 nonce 저장 방식은 세션 08의 위협 모델 검토에서 확정하되 API 비공개 불변식은 바꾸지 않는다.

## D-020. 공개 실명은 명시적 동의 기반

- 배경: PRD의 공개 순위는 실명을 포함하지만 참가 신청 프롬프트는 실명 공개 동의를 선택 정보로 다룬다.
- 결정: `realNamePublic`의 기본값은 false다. 방문자용 순위·프로필에는 동의한 참가자만 실명을 표시하고, 미동의자는 Riot ID만 표시한다. 본인과 권한 있는 관리자 화면은 운영 목적 범위에서 실명을 볼 수 있다.
- 대안과 기각 이유: 기본 공개는 소규모 대회라도 개인정보 최소화 원칙에 어긋난다. 전면 비공개는 참가자가 원하는 동아리 내 표시를 막는다.
- 데이터/마이그레이션 영향: 사용자 또는 시즌 참가 관계에 동의 여부·동의 시각을 저장한다. 기존 사용자는 false로 backfill한다.

## D-021. 가입 후 인증과 loginId 기본 정책

- 배경: 인증 세션 프롬프트가 가입 후 자동 로그인 여부와 loginId 정책을 결정 로그에 고정하도록 요구한다.
- 결정: 가입 성공 후 자동 로그인하지 않고 로그인 화면으로 이동해 자격 증명을 다시 확인한다. loginId는 NFKC 정규화와 trim 후 소문자로 비교하며, 4~32자의 ASCII 소문자·숫자·점(`.`)·밑줄(`_`)·하이픈(`-`)만 허용한다. 원문과 비교용 normalized 값을 분리한다.
- 대안과 기각 이유: 자동 로그인은 편하지만 session 생성·회전 경계를 가입 mutation과 결합한다. Unicode 전체 허용은 시각적 혼동과 정규화 충돌 위험이 크다.
- 데이터/마이그레이션 영향: 기존 값 도입 시 normalized 충돌 보고서를 먼저 만들고 unique constraint를 적용한다.

## D-022. 2026-08-04 Riot 정책 확인 결과와 보수적 운영 기준

- 배경: 패키지는 2026-08-03의 새 커뮤니티 가이드와 Competition Visibility Form을 언급하지만, 2026-08-04 감사에서 접근 가능한 공식 원문 링크를 확인하지 못했다. 반면 Riot Developer General Policies(공개 페이지 최종 갱신 2025-03-11)는 tournament policy로 최소 20명과 공정·투명한 승리 조건, 도박 금지를 명시한다.
- 결정: 새 원문의 적용 범위와 우선순위가 공식 채널에서 확인될 때까지 최소 20명을 출시 체크로 적용한다. Competition Visibility Form 제출은 공식 URL과 적용 범위를 확인하기 전에는 권장 운영 항목으로만 표시하고 제출 완료를 가장하지 않는다. 개최 직전 Developer General Policies, 한국 적용 대회 가이드, 제품 등록 상태를 다시 확인한다.
- 대안과 기각 이유: 출처를 재현할 수 없는 최신 주장만으로 최소 인원 규칙을 제거하는 것은 출시 정책 위험이 크다.
- 데이터/마이그레이션 영향: schema 영향은 없다. 시즌 시작 validation과 릴리스 체크리스트에 정책 확인 일자·원문 URL·결론·증빙 필드를 둔다.

## D-023. 무료 동기화의 기본 스케줄러

- 배경: 2026-08-04 Vercel 공식 문서상 Hobby Cron은 하루 1회, 지정 시간 내 최대 59분 오차이며 실패 재시도를 제공하지 않는다.
- 결정: 무료 운영의 기본은 GitHub Actions 약 5분 예약 호출과 관리자 수동 복구다. Vercel Hobby Cron은 일일 유지 작업 외의 경기 동기화에 사용하지 않는다. 안정 운영은 Vercel Pro 이상 또는 별도 worker를 선택한다.
- 대안과 기각 이유: Hobby Cron은 경기 종료 후 수 분 내 반영 목표를 구조적으로 충족하지 못한다.
- 데이터/마이그레이션 영향: schema 영향은 없다. `SYNC_MODE` validation과 운영 UI가 Hobby 제한을 명시한다.

## D-024. MVP 기준이 없는 티어의 처리

- 배경: v1 baseline bucket은 PLATINUM 이상만 정의하지만 참가 자격에 하위 티어 제한은 없다.
- 결정: 해당 참가자의 시작 티어에 대응하는 게시된 non-demo baseline bucket이 없으면 평가 상태를 `PENDING_BASELINE`으로 기록하고 MVP/ACE 재추첨권을 지급하지 않는다. 임의로 PLATINUM bucket에 매핑하지 않는다.
- 대안과 기각 이유: 근거 없는 근접 티어 매핑은 표준화 결과와 보상 신뢰성을 훼손한다.
- 데이터/마이그레이션 영향: 평가 상태/오류 코드를 저장하고 관리자 경고·baseline coverage report를 제공한다.

## D-025. 법적 문서 동의의 버전 보존

- 배경: User의 동의 시각만으로는 어떤 이용약관·개인정보 문서에 동의했는지 재현할 수 없다.
- 결정: 게시된 `LegalDocument`에 대한 append-only `LegalConsent(userId, legalDocumentId, acceptedAt)`를 저장한다. 최신 동의 시각 cache를 둘 수 있지만 권위는 consent 이력이다.
- 대안과 기각 이유: User 행의 version 문자열 두 개만 저장하면 재동의와 여러 문서 유형의 이력이 유실된다.
- 데이터/마이그레이션 영향: 세션 02 최초 migration에 `LegalConsent`와 `(userId, legalDocumentId)` unique를 추가한다.

## D-026. Credentials 인증의 세션·비밀번호·시도 제한 정책

- 배경: 세션 04 구현에는 JWT/DB 세션의 실제 만료 시간, 회전 방식, 비밀번호 범위, 로그인 제한 수치와 가입 시 어떤 법적 문서 버전을 동의로 남길지 구체값이 필요하다.
- 결정: 일반 세션은 12시간, `로그인 유지` 세션은 30일이다. 로그인할 때 기존 브라우저 세션을 폐기하고 새 opaque `jti`를 발급하며, 명시적 rotation endpoint는 기존 세션을 한 번만 폐기·교체한다. JWT에는 `sub`, `role`, `jti`, `iat`, `exp`만 넣고 DB `AuthSession`의 jti hash, revoke/expiry, 사용자 상태, `sessionVersion`, 현재 role을 매 요청 확인한다. 비밀번호는 12~128자를 허용하며 구성 문자 강제 대신 길이와 Argon2id(`memoryCost=19456`, `timeCost=2`, `parallelism=1`, 32-byte hash)를 적용한다. 로그인은 IP+loginId 기준 15분 동안 5회 실패 시 15분, loginId 기준 1시간 동안 20회 실패 시 30분 제한한다. 가입은 IP 기준 15분 동안 10회로 제한한다. 잠금·비활성·미존재·오입력 계정은 같은 credential 오류를 반환한다. 가입 시점에 효력이 있는 최신 `TERMS`와 `PRIVACY` 게시 문서를 transaction 안에서 선택해 append-only `LegalConsent`로 저장하고 가입 후에는 자동 로그인하지 않는다. 세션 04 UI/API의 `displayName`은 기존 데이터 모델의 `User.realName` 프로필 필드에 저장하고 공개 동의 기본값은 false로 유지한다. 실명과 별칭을 둘 다 받아야 하는 요구가 생기면 필드를 분리하는 migration을 별도 결정한다. 상태 변경 HTTP 요청은 `APP_URL`과 정확히 일치하는 Origin을 요구한다.
- 대안과 기각 이유: JWT만 확인하면 로그아웃·권한 변경을 즉시 반영할 수 없고, 영구 계정 잠금은 공격자가 알려진 ID를 의도적으로 잠그는 DoS 수단이 된다. 짧은 저비용 hash나 비밀번호 구성 규칙만 강제하는 방식은 긴 passphrase보다 실효성이 낮다. 클라이언트가 법적 문서 ID를 권위 있게 보내게 하면 오래된 버전 동의를 위조할 수 있다.
- 데이터/마이그레이션 영향: 현재 `User`, `AuthSession`, `LoginAttempt`, `LegalDocument`, `LegalConsent`, `AuditLog` 모델로 구현 가능해 schema migration은 없다. `LoginAttempt`는 단기 운영 데이터로 보존 기간 정리 작업이 필요하다.

## D-027. 참가 신청 재제출·승인 시즌·중도 참가 정책

- 배경: 참가 신청에는 기존 PENDING 처리, 거절 후 재신청, 승인할 시즌 선택, 시즌 시작 후 초기 상태를 일관되게 만드는 구체 정책이 필요하다.
- 결정: 사용자당 PENDING 신청은 DB partial unique index로 하나만 허용한다. PENDING 신청은 사용자가 덮어쓰지 않고 관리자가 승인·거절·재검증하며, 거절 후에는 기존 행을 보존하고 새 신청 행을 만든다. 승인 후 Riot ID 변경은 새 참가 신청이 아니라 PUUID 기준 신원 갱신 절차로 처리한다. 승인은 ACTIVE 시즌이 하나면 그 시즌, ACTIVE가 없으면 시작일이 가장 이른 SCHEDULED 시즌을 대상으로 한다. ACTIVE 시즌이 여러 개거나 남은 주차가 없으면 승인을 차단한다. 시즌 시작 후 승인은 관리자 경고 확인과 사유를 요구하고, 신청 검증 시점의 솔로 랭크를 시작 `RankSnapshot`으로 고정하며 승인 시점 이후 종료되는 현재·미래 주차에만 `ParticipantWeek`를 만든다. 같은 PUUID의 동시 승인은 `Participant.puuid` unique와 serializable transaction으로 한 건만 성공한다.
- 대안과 기각 이유: PENDING 행을 재사용하면 신청·검증 이력이 사라진다. 종료된 주차에도 0점 상태를 소급 생성하면 당시 순위와 참가자 집합이 왜곡된다. 관리자가 매번 시즌을 임의 선택하게 하면 현재 단일 대회 운영에서 잘못된 시즌 연결 가능성이 커진다.
- 데이터/마이그레이션 영향: `ParticipationApplication`에 주·부 포지션을 추가하고 `(userId) WHERE status='PENDING'` unique index 및 `(puuid,status)` 조회 index를 추가한다. 실명 공개 동의는 기존 `User.realNamePublic`과 동의 시각에 저장한다.

## D-028. 포인트 nonce 보호와 키 수명

- 배경: commitment 검증을 위해 공개 시 nonce 원문이 필요하지만, 공개 전 DB snapshot·backup만 유출된 경우 실제 점수를 역산할 수 없어야 한다. 한편 nonce는 공개 후에도 과거 commitment를 재검증할 수 있어야 하므로 단방향 hash만 저장할 수 없다.
- 결정: nonce는 32-byte 안전 난수를 canonical base64url로 표현하고 AES-256-GCM으로 보호한다. 키는 HKDF-SHA-256으로 `POINT_DRAW_SECRET`에서 도메인 분리해 만들며 associated data에 envelope version, draw ID, FIRST/SECOND phase를 결합해 다른 행이나 phase로 ciphertext를 옮기면 복호화가 실패하게 한다. production은 인증·Cron secret과 독립된 32자 이상의 `POINT_DRAW_SECRET`을 필수로 요구한다. 개발·테스트만 설정 편의를 위해 `AUTH_SECRET` fallback을 허용한다. 일반 select, DTO, 오류, AuditLog, outbox에는 보호 전 nonce를 넣지 않는다. 이 위협 모델은 DB·backup 단독 유출을 방어하지만 실행 중인 애플리케이션과 secret이 함께 탈취된 경우까지 방어하지는 않는다.
- 대안과 기각 이유: 평문·단순 base64 저장은 DB 단독 유출에서 봉인이 사라진다. nonce hash만 저장하면 공개와 사용자 검증이 불가능하다. 초기 약 20명 서비스에서 외부 KMS를 필수화하면 개발·복구 복잡도가 과도하므로 후속 확장으로 둔다.
- 데이터/마이그레이션 영향: 기존 `firstNonceEncryptedOrProtected`·`secondNonceEncryptedOrProtected` 문자열에 versioned envelope를 저장한다. 키 회전 전 기존 nonce를 새 키로 transactionally 재암호화하고 검증하는 운영 도구가 필요하며, 해당 도구 없이 기존 키를 폐기하면 과거 미공개 결과를 복구할 수 없다. commitment version과 RNG version은 별도 필드로 저장하고 경기별 initial/reroll ledger는 partial unique index로 각각 한 행만 허용한다.

## D-029. MVP/ACE metric 계약과 누락 처리

- 배경: D-006은 4개 group의 비중을 정하지만 group 내부 raw metric과 누락 허용 경계가 없으면 구현마다 결과가 달라지고 관리자 설명을 재현할 수 없다.
- 결정: v1은 group별 4개, 총 16개 metric을 사용한다. 시야·오브젝트는 분당 시야 점수·설치 와드·제거 와드·오브젝트 피해, 성장은 분당 골드·CS·레벨·포탑 피해, 피해는 분당 챔피언 피해·받은 피해·감소시킨 피해·아군 회복/보호막, KDA·관여는 분당 킬·어시스트·KDA·킬 관여율이다. 각 group에서 4개 중 3개 이상(75%)이 유효하면 유효 metric에 동일 weight를 결정론적으로 재분배하고, 3개 미만이면 `PENDING_DATA`로 보류한다. baseline은 모든 position·tier bucket·16개 metric을 가져야 하며 `stdDev > 0`, `sampleSize >= 30`만 게시할 수 있다.
- 대안과 기각 이유: 누락값을 z-score 0으로 대체하면 실제 평균 관측과 미관측을 구분할 수 없다. group 전체 weight를 다른 group으로 넘기면 D-006의 70/30 의미가 바뀐다.
- 데이터/마이그레이션 영향: DEMO_ONLY seed baseline은 320행으로 교체한다. 평가 `metrics` JSON에 raw·mean·stddev·z-score·winsorize·effective weight·coverage를 저장한다.

## D-030. MVP/ACE 평가의 시즌 범위와 append-only 재평가

- 배경: 동일 Riot 경기가 겹치는 시즌에 포함될 수 있고, baseline 미게시·tier/position 누락 상태가 나중에 해소되거나 evaluator 결함을 새 버전으로 교정할 수 있다. 기존 `(rawParticipant, baseline)` 유일 키와 필수 score 필드는 이 이력을 표현하지 못한다.
- 결정: 평가는 `seasonMatch` 범위에 속하며 `COMPLETED`, `PENDING_BASELINE`, `PENDING_DATA`, `INVALID_MATCH` 상태를 가진다. `evaluationKey`는 시즌 경기·raw 참가자·evaluator version·baseline과 점수·팀 순위·award를 포함한 결정론적 결과 fingerprint를 canonical hash한 멱등 키다. 기존 평가 행은 update/delete하지 않고, 조건 해소 또는 evaluator 교정 시 새 행이 `supersedesEvaluationId`로 이전 행을 가리킨다. 팀 award는 정확히 5명 전원이 `COMPLETED`일 때만 선택한다. 경기 참가자별 시작 tier는 Riot 호출을 DB transaction 밖에서 수집해 raw snapshot에 보존하며, GOLD 이하 또는 unranked를 임의로 PLATINUM에 매핑하지 않는다.
- 대안과 기각 이유: raw 경기 전역 유일 평가는 시즌별 baseline·참가 자격을 구분하지 못한다. pending 행을 completed로 덮어쓰면 최초 보류 사유와 운영 감사 이력이 사라진다.
- 데이터/마이그레이션 영향: `MvpEvaluationStatus`, `evaluationKey`, `seasonMatchId`, nullable score/tier/position, `errorCode`, `supersedesEvaluationId`와 raw participant의 `startingTier`·`tierBucket`을 추가한다. 평가 행과 게시 baseline 내용은 DB trigger로 immutable하게 보호한다.

## D-031. 타임라인 미션의 시각·아이템·누적 판정 규칙

- 배경: M056~M100은 millisecond 타임라인, 정확한 분 프레임의 부재, 구매·판매·되돌리기 순서, 정적 데이터 분류, 역순 경기 수집을 동일하게 해석해야 한다. 특히 처리 순서대로 연승을 더하면 Match-V5 페이지 순서에 따라 결과가 달라진다.
- 결정: timestamp는 공용 경계에서 millisecond와 second를 변환하고 `이전` 조건은 strict `<`로 판정한다. 10/15/20분 CS는 정확한 프레임이 없으면 해당 참가자를 포함한 가장 가까운 직전 안전 프레임을 사용하며, 목표 시각 전에 끝난 경기는 실패, 충분히 길지만 안전 프레임이 없으면 `PENDING_DATA`다. 아이템 이벤트는 timestamp 순으로 재생하고 `ITEM_UNDO`의 `beforeId`를 제거하고 `afterId`를 복구한다. 2분 시작 구매 비용은 strict 120초 전 최종 inventory의 DDragon 원가 합이며 trinket을 제외한다. 아이템·챔피언 분류는 경기 patch의 정적 데이터와 사용 버전을 증거에 남긴다. 누적은 append-only signed delta로 기록하고 distinct는 set semantics를 사용한다. 연승은 수집 순서가 아니라 assignment 활성 이후 인정 경기의 `gameStartAt` 순으로 정규화해 현재값·최댓값·최초 목표 달성 경기를 계산한다. M100은 게시된 non-demo MVP/ACE 평가만 완료로 인정한다.
- 대안과 기각 이유: 다음 프레임을 사용하면 목표 시각 이후 CS가 섞이고, 누락 프레임을 0으로 보면 수집 장애가 실패로 굳어진다. 처리 순서 기반 연승은 역순 pagination에서 거짓 연승 또는 누락을 만들며, item ID 목록을 코드에 고정하면 patch 변경을 안전하게 반영하지 못한다.
- 데이터/마이그레이션 영향: 기존 `MissionProgressEvent`, `MissionCompletionLedger`, assignment progress와 JSON evidence로 표현할 수 있어 schema migration은 없다. evaluator 또는 분류 규칙을 바꿀 때는 새 definition/evaluator version과 correction event를 사용한다.

## D-032. 미션 효과가 있는 경기의 무효화는 재구축 경로 전까지 fail-closed

- 배경: 경기 무효화는 메인 점수 reversal만으로 끝나지 않는다. 해당 경기에서 생성된 미션 진행·완료·점수와 그 뒤의 assignment 상태까지 함께 재구축하지 않으면 append-only 원장과 표시 cache가 서로 달라진다. 현재 범용 미션 재생성 작업은 이 전체 연쇄를 안전하게 되돌리지 않는다.
- 결정: 대상 참가 경기와 연결된 `MissionProgressEvent`가 하나라도 있으면 관리자 경기 무효화를 mutation 시작 전에 `SCORING_CONFLICT`로 차단한다. 미션 효과가 없는 경기는 기존처럼 append-only score reversal과 AuditLog를 만든다. 영향 경기의 교정은 원본 보존, 새 evaluator version, signed correction event와 대사 절차가 준비된 운영 경로로만 수행한다.
- 대안과 기각 이유: 미션 event나 completion 원장을 delete/update하면 감사 이력이 깨진다. 메인 점수만 먼저 뒤집고 미션을 나중에 고치는 방식은 그 사이 잘못된 순위·완료 보상·스냅샷을 노출한다.
- 데이터/마이그레이션 영향: schema migration은 없다. 무효화 전 존재 검사와 통합 테스트를 추가한다. 범용 미션 rebuild/correction workflow가 구현되기 전까지 이 차단은 알려진 운영 제한이다.

## D-033. 회원가입과 법적 문서 동의의 분리

- 배경: 소규모 비공개 대회 계정 생성에서 이용약관·개인정보 동의 UI와 게시 문서 존재 여부가 가입을 불필요하게 차단한다.
- 결정: 회원가입은 이용약관·개인정보 동의 입력을 받지 않고, 게시된 `TERMS`·`PRIVACY` 문서의 존재 여부를 검사하지 않는다. 신규 계정 생성 시 `LegalConsent`를 만들거나 `termsAcceptedAt`·`privacyAcceptedAt`을 채우지 않는다. `/rules`의 법적 문서 게시·조회 기능과 기존 동의 이력은 보존한다. 이 결정은 가입 시 동의를 요구하던 D-025와 D-026의 해당 부분을 대체한다.
- 대안과 기각 이유: UI만 숨기고 서버 검증을 유지하면 문서 미게시 환경에서 가입이 계속 실패하며, 클라이언트가 보이지 않는 동의 값을 자동 전송하면 실제 동의 없이 동의 이력이 생성된다.
- 데이터/마이그레이션 영향: 기존 nullable 필드와 `LegalConsent` 테이블을 유지하므로 schema migration은 없다. 신규 가입자의 동의 시각은 null이고 동의 행은 생성되지 않는다.

## D-034. 회원가입 비밀번호 최소 길이 완화

- 배경: 소규모 비공개 대회의 회원가입 편의를 위해 기존 12자 최소 길이를 완화해야 한다.
- 결정: 회원가입 비밀번호는 4~128자를 허용한다. 기존 계정의 비밀번호 변경은 12~128자 정책을 유지하며, 모든 비밀번호는 계속 Argon2id로 해시한다. 이 결정은 D-026의 회원가입 최소 길이에 한해 대체한다.
- 대안과 기각 이유: 비밀번호 변경까지 동시에 4자로 완화하면 요청 범위를 넘어 기존 계정 보안 정책도 낮아진다.
- 데이터/마이그레이션 영향: 입력 검증 규칙만 변경되므로 schema migration은 없다.
