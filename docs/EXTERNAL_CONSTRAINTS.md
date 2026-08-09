# 외부 서비스 제약과 구현 경계

이 문서는 구현 시 변하기 쉬운 외부 규칙을 코드에 흩뿌리지 않기 위한 체크리스트다. 실제 작업일에 공식 문서를 다시 확인하고, 확인 날짜와 결론을 `docs/DECISIONS.md` 또는 릴리스 노트에 기록한다.

## 1. Riot Developer API

### 1.1 계정 식별

- 사용자 입력은 `gameName#tagLine` 형식의 Riot ID다.
- Account-V1의 regional routing으로 Riot ID를 PUUID로 변환한다.
- 이후 내부 참조와 Match-V5 조회의 기준 식별자는 PUUID다.
- 표시 이름 변경은 동일 PUUID를 기준으로 history에 기록한다.

### 1.2 라우팅

- 한국 리그·소환사 관련 platform 호출은 KR host를 사용한다.
- Account-V1 및 Match-V5는 ASIA regional host를 사용한다.
- host 문자열을 UI나 여러 서비스에 복제하지 말고 Riot client 설정 한 곳에서 관리한다.
- 2026-08-05 공식 API reference 재확인 결과, 현재 구현은 Account-V1 `accounts/by-riot-id`, Summoner-V4 `summoners/by-puuid`, League-V4 `entries/by-puuid`, Match-V5의 `matches/by-puuid/{puuid}/ids`·match·timeline method를 사용한다.

### 1.3 키 보안

- API 키는 서버 환경 변수에서만 읽는다.
- `NEXT_PUBLIC_*`, 브라우저 bundle, 로그, 오류 응답에 포함하지 않는다.
- 클라이언트가 임의 Riot endpoint를 대신 호출하게 하는 범용 proxy를 만들지 않는다.
- 401/403은 키 만료·권한 문제로 분리하고, 429는 `Retry-After`를 존중한다.
- 개발 키가 만료되어도 Mock 모드와 나머지 사이트가 작동해야 한다.

### 1.4 API 제품 등록과 운영 준비

커뮤니티 대회 운영 허용 여부와 Riot API 제품 등록은 서로 다른 절차로 취급한다.

- 공개 API 제품 운영 전 Riot Developer Portal의 제품 등록·Production key 요건을 확인한다.
- 개발 키는 prototype 용도이며 만료될 수 있으므로 공개 서비스의 영구 자격 증명으로 취급하지 않는다.
- 기능이 작동하는 사이트, 개인정보처리방침, 이용약관, 제품 설명, 데이터 사용 흐름을 준비한다.
- Riot Sign On은 초기 버전의 필수 사항이 아니다. Production 앱 승인과 별도 요구사항이 충족된 뒤 후속 단계로 도입한다.
- Riot이 요구하는 비공식 제품 고지 문구를 footer와 규칙 문서에 제공한다.

### 1.5 커뮤니티 대회 운영 경계

2026-08-04 감사에서 접근 가능한 공식 원문을 기준으로 삼고, 실제 개최 직전에 적용 지역 문서를 다시 확인한다. 패키지가 언급한 2026-08-03 가이드와 Competition Visibility Form의 공식 URL은 이번 감사에서 재현하지 못했다.

- 지역 LAN, 학교·대학, 온라인 커뮤니티 대회 등은 적용 지역의 가이드라인을 확인한다. 공개된 Riot Developer General Policies(페이지 최종 갱신 2025-03-11)는 대회 최소 20명을 명시하므로, 더 최신의 적용 가능한 공식 원문이 확인될 때까지 이를 보수적 기준으로 적용한다.
- 별도 사전 허가 필요 여부는 적용 지역·대회 유형의 공식 원문으로 확인하며, 확인 전에는 불필요하다고 단정하지 않는다.
- Competition Visibility Form 또는 후속 제출 양식은 공식 URL과 적용 범위를 확인한 경우에만 제출하고 증빙을 운영 기록에 남긴다.
- 운영 주체가 정부기관·비승인 기업 브랜드·프로 LoL Esports 팀/선수 등 적용 제외 범주에 해당하는지 확인한다.
- 이벤트 이름과 홍보물은 Riot Games 또는 LoL Esports의 공식 주최·승인·후원 행사로 오인되지 않게 한다.
- Riot Games 로고와 Worlds, MSI, LCK 등 공식 esports 대회 상표를 이벤트 브랜딩에 사용하지 않는다.
- 허용된 League of Legends 자산은 대회 홍보에 필요한 범위에서 원형을 유지해 사용하며, 스폰서 제품을 보증하는 방식으로 사용하지 않는다.
- 도박·스포츠 베팅·카지노 등 최신 가이드라인의 금지 스폰서 범주를 받지 않는다.
- 참가비·상금·스폰서가 생기면 합리적이고 공정하게 운영하고 관련 법률·세무·약관을 별도로 검토한다.

### 1.6 점수제와 정책상 안전 장치

- 대회 규칙은 참가자에게 공개하고 공정하게 적용한다.
- 현금 베팅, 유료 재추첨, 현금성 환전, 구매형 확률 요소를 넣지 않는다.
- 17~23점의 각 확률과 재추첨 규칙을 사전에 공개한다.
- 무상·비현금형 점수 연출이라도 출시 전 최신 Riot 정책과 국내 적용 법률을 다시 확인한다.
- 검토 결과가 불확실하면 `POINT_MODE=FIXED_20`으로 운영할 수 있어야 한다.
- Riot 로고·화면·상표를 공식 서비스처럼 보이게 복제하지 않는다.

### 1.7 정적 데이터

- 챔피언·아이템 이미지와 분류는 사용 가능한 공식 정적 데이터 자산을 우선한다.
- 프로필·챔피언·아이템·스펠·룬 URL은 `src/lib/riot-assets.ts`에서만 생성하고 Data Dragon host와 안전한 경로만 허용한다.
- 랭크 엠블럼은 Riot Developer Portal의 `ranked-emblems-latest.zip` 원본을 `public/riot/ranked-emblems`에 보존하며 출처와 갱신일을 함께 기록한다.
- gameVersion과 정적 데이터 버전이 다를 수 있으므로 nearest-compatible resolver와 fallback을 둔다.
- 원격 이미지 실패 시 텍스트·placeholder로 화면이 깨지지 않아야 한다.
- 2026-08-05 공식 LoL 문서는 Data Dragon 갱신이 client patch와 늦을 수 있음을 명시하므로, exact major/minor 최신 build → 같은 major의 가까운 minor → last-known-good cache → 제한된 bundled metadata 순으로 해석한다.

## 2. 스케줄러와 배포

### 2.1 Vercel

- 2026-08-05 공식 문서 재확인 기준 Hobby Cron은 하루 1회만 허용되고 지정 시간 안에서 최대 59분 오차가 있으므로 준실시간 경기 동기화에 사용하지 않는다.
- 모든 Cron endpoint는 `CRON_SECRET` 또는 동등한 서명 검증을 요구한다.
- 서버리스 함수는 시간 제한이 있으므로 전체 참가자를 한 요청에서 무한 처리하지 않는다.
- batch size, cursor, lease, 다음 실행 continuation을 사용한다.
- Vercel Cron은 실패 invocation을 자동 재시도하지 않으므로 수동 복구와 다음 overlap sync를 제공한다.

### 2.2 GitHub Actions 예약 호출

- 무료 운영 대안으로 서명된 sync endpoint를 예약 호출할 수 있다.
- 예약 실행은 혼잡 시 지연되거나 누락될 수 있으므로 정확한 분 단위 SLA로 표현하지 않는다.
- workflow 권한은 최소화하고 secret은 repository secret에서 읽는다.
- 로그에 endpoint secret이나 Riot key를 출력하지 않는다.
- 장기간 저장소 활동이 없을 때 예약 실행 상태를 운영자가 점검한다.
- 예약 workflow의 최소 간격은 5분이지만 혼잡 시 지연되거나 queued job이 누락될 수 있다. 공개 저장소는 60일간 활동이 없으면 schedule이 자동 비활성화될 수 있다.

### 2.3 권장 모드

| 상황 | 동기화 방식 |
|---|---|
| 로컬 개발 | Mock + 관리자 수동 동기화 |
| 내부 데모 | 관리자 수동 + 제한된 기회성 동기화 |
| 무료 동아리 운영 | GitHub Actions 예약 호출 + 수동 복구 |
| 안정적인 본 운영 | 유료 Cron 또는 별도 worker/queue |

## 3. PostgreSQL·Prisma

- 앱과 마이그레이션이 같은 production DB를 무분별하게 동시에 변경하지 않는다.
- 로컬은 migration 생성, CI는 drift 검증, production은 승인된 deploy migration만 수행한다.
- 점수·미션·경기 처리의 핵심 유일성은 애플리케이션 검사뿐 아니라 DB unique constraint로 보장한다.
- 장시간 외부 API 호출을 DB transaction 안에서 수행하지 않는다.
- connection pool 환경과 serverless adapter의 현재 권장 구성을 작업 시 공식 문서로 재확인한다.

## 4. 인증

- 사이트 자체 Credentials 인증은 Riot 계정 소유 인증과 동일하지 않다.
- 초기 내부 대회에서는 Riot ID 제출과 관리자 승인으로 참가자를 연결한다.
- 비밀번호는 Argon2id로 해시하며 평문·복호화 가능한 형태를 저장하지 않는다.
- 세션은 HttpOnly, Secure(production), SameSite=Lax 기본 쿠키를 사용한다.
- 상태 변경 요청은 origin 검증 또는 CSRF 방어를 적용한다.
- 로그인·신청·관리자 동작에 rate limit과 감사 로그를 적용한다.

## 5. 구현 시 재확인 체크리스트

- [ ] 현재 안정 Next.js·React·Prisma 버전과 호환성
- [ ] Riot API method·DTO·routing·rate limit 정책
- [ ] Queue ID 및 솔로 랭크 판정 상수
- [ ] Match-V5 Challenges/Timeline 필드의 실제 fixture
- [ ] Riot API 제품 등록·Production key와 비공식 제품 고지 문구
- [ ] 최신 Community Competition Guidelines 적용 범위·브랜딩·금지 스폰서 확인
- [ ] 적용 가능한 공식 대회 제출 양식의 존재·URL·제출 여부와 증빙 기록
- [ ] Vercel 함수·Cron 플랜 제한
- [ ] GitHub Actions 예약 실행 제약
- [ ] 개인정보 보존 기간과 동아리 내부 운영 동의
- [ ] 이벤트 시작 전 실 API로 최소 3개 계정의 end-to-end dry run
