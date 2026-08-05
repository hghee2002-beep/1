# 기획·프롬프트 패키지 검토 결과

## 1. 결론

이 프로젝트는 **시각 프로토타입은 원샷 가능**, **실제 운영형은 단계별 구현이 필요**하다.

원샷 전체 구현이 불안정한 이유는 단순한 코드 양이 아니라 다음 상태가 서로 원자적으로 연결되어야 하기 때문이다.

- 같은 Riot 경기를 여러 동기화 경로가 발견할 수 있음
- 첫 포인트는 사용자 공개 전 이미 순위에 반영되어야 함
- MVP/ACE 평가가 완료된 뒤에만 재추첨 자격이 생김
- 재추첨은 기존 점수를 수정하지 않고 차이 원장을 추가해야 함
- 미션은 “현재 활성 상태”가 아니라 경기 시작 당시 상태로 평가해야 함
- 6시간 보충과 1시간 리롤이 scheduler 지연·중복 호출에도 일관되어야 함
- 실제 MVP 기준 데이터와 Riot Production Key는 코드 생성으로 대체할 수 없음

따라서 저장소 공통 지침을 `AGENTS.md`에 고정하고 세션 00~18을 순차 실행하는 안을 기본으로 채택했다.

## 2. 확정·보완한 핵심 사항

### 포인트 공개의 악용 방지

사용자가 패배 결과 공개를 미뤄 순위를 늦게 반영하는 문제를 막기 위해, 포인트는 경기 처리 시 서버에서 생성·원장 반영한다. 공개 버튼은 이미 봉인된 결과를 보여주는 동작이다.

### 공정성 검증

첫 결과의 value와 nonce로 commitment를 만들고, 공개 후 검증할 수 있게 했다. 각 17~23 값은 1/7이며, 클라이언트 난수를 사용하지 않는다.

### Riot 절차 분리와 정책 fallback

Riot API를 공개 제품에 사용하는 경우의 제품 등록·키 요건과 커뮤니티 대회 운영 정책은 별도 절차다. 2026-08-04 세션 00 감사에서는 패키지가 언급한 2026-08-03 가이드와 Competition Visibility Form의 접근 가능한 공식 원문을 재현하지 못했고, 공개된 Riot Developer General Policies에는 대회 최소 20명이 명시되어 있음을 확인했다. 두 절차를 하나의 “Riot 승인”으로 뭉뚱그리지 않되, 개최 전 공식 원문을 재확인하고 그전에는 최소 20명을 보수적으로 적용한다.

확률형 점수는 현금·유료 요소가 없더라도 출시 전 최신 Riot 정책과 국내 적용 법률 검토가 필요할 수 있다. 코드 전체를 바꾸지 않고 `POINT_MODE=FIXED_20`으로 전환할 수 있게 명세했다.

### MVP/ACE 신뢰성

실제 표본 데이터가 없는 상태에서 그럴듯한 평균·표준편차를 생성하지 않는다. 개발 fixture는 `DEMO_ONLY`이며 production 보상은 기본 차단한다.

### 미션 충돌 해결

- 완료 미션: 같은 주차 재등장 금지
- 리롤 미션: 후순위로 이동, unseen 미션 소진 후에만 재후보
- 새 주차: 상태 초기화, 새 5개 지급
- 경기 중 리롤: 경기 시작 snapshot으로 판정

### 준실시간 정의

게임 중 실시간 감지가 아니라 경기 종료 후 Match-V5 데이터가 제공된 뒤 수 분 안에 반영되는 구조다. 화면은 15~30초 간격으로 갱신하고, sync는 수동/예약/worker adapter를 공유한다.

### 관리자 수정

점수 직접 덮어쓰기와 경기 hard delete를 금지했다. 조정·무효화·복구는 append-only 원장과 AuditLog로 추적한다.

## 3. 패키지 구성 검토

- 제품 PRD: 사용자, 화면, 관리자 13영역, 품질·정책·출시 조건 포함
- 아키텍처: UI/application/domain/infrastructure 경계와 sync pipeline 포함
- 데이터 모델: 인증부터 원장·미션·작업·감사까지 포함
- 미션: M001~M100 고유 코드와 evaluator 전략 포함
- 테스트: unit/integration/contract/E2E/security/accessibility/performance 포함
- Runbook: 환경 변수, API 연결, 동기화, 대사, 장애, 종료·백업 포함
- Codex 지침: AGENTS/PLANS와 00~18 단계별 prompt 포함
- 원샷 선택지: 시각 프로토타입용과 전체 장기 시도용을 분리

## 4. 의도적으로 확정하지 않은 외부 항목

다음은 Codex가 임의로 만들어서는 안 되며, 실제 작업 시 공식 문서·운영자 입력으로 확정한다.

- 작업일의 정확한 Next.js/Prisma 등 package version
- 현재 Riot Queue ID와 API DTO의 optional field 상태
- Riot API 제품 등록과 공개 운영에 맞는 key 승인
- 적용 지역의 최신 Community Competition Guidelines 공식 원문과 제출 양식 존재 여부 확인
- 공식 고지 문구의 최신 원문
- 개인정보처리방침·이용약관의 최종 법적 문구
- 실제 MVP/ACE 기준 데이터의 출처와 표본
- Vercel/GitHub scheduler의 실제 선택 플랜
- production DB provider, domain, backup 정책

## 5. 구현 중 중단 기준

다음 상태에서는 다음 기능으로 넘어가지 않고 현재 세션을 수정해야 한다.

- migration from empty DB 실패
- 동일 경기 재처리 시 점수 변화
- ledger와 cached score 불일치
- reveal 전 value/nonce 노출
- 동시 reroll 두 건 성공
- 미션 snapshot 경계 실패
- USER의 admin mutation 성공
- Riot/CRON secret의 client 또는 로그 노출
- DEMO_ONLY baseline의 production entitlement 발급

## 6. 권장 사용법

- 첫 시각 검토: `prompts/ONE_SHOT_VISUAL_PROTOTYPE.md`
- 실제 제작 시작: `prompts/START_HERE.md` 또는 바로 `prompts/00_REPOSITORY_AUDIT_AND_PLAN.md`
- 각 세션 후 검증 통과 상태를 commit
- 세션 17에서 출시 준비, 세션 18에서 독립 최종 감사
- 한 번에 전체 시도는 `MASTER_FULL_BUILD_ATTEMPT.md`를 사용하되 단계별 경로보다 신뢰도가 낮음을 전제로 함
