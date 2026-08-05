# 세션 00 — 저장소 감사와 실행 계획

이 세션의 목적은 코드를 성급히 생성하는 것이 아니라, 현재 저장소를 정확히 파악하고 이후 18개 세션이 충돌 없이 진행될 실행 계획을 만드는 것이다. 이 세션에서는 제품 기능을 본격 구현하지 마라. 문서의 명백한 모순·누락을 바로잡는 것과 최소한의 검사 스크립트 추가만 허용한다.

## 수행 작업

1. 다음 파일을 모두 읽어라.
   - `README_FIRST.md`
   - `AGENTS.md`
   - `PLANS.md`
   - `docs/DECISIONS.md`
   - `docs/PRD.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DATA_MODEL.md`
   - `docs/MISSION_CATALOG.md`
   - `docs/TEST_PLAN.md`
   - `docs/RUNBOOK.md`
   - `docs/EXTERNAL_CONSTRAINTS.md`
2. Git 상태, 파일 구조, package manager, Node 설정, 기존 Next.js/Prisma 여부, 테스트·CI·환경 변수 파일을 조사하라.
3. 문서와 기존 구현을 대조해 다음을 분류하라.
   - 이미 충족
   - 부분 충족
   - 미구현
   - 서로 충돌
   - 외부 자격 증명/운영 결정 필요
4. `IMPLEMENTATION_PLAN.md`를 `PLANS.md`의 템플릿에 맞춰 작성하라. 세션 01~18 각각에 대해:
   - 목표
   - 예상 변경 영역
   - 선행조건
   - 데이터 migration 위험
   - 검증 명령
   - 완료 조건
   을 적어라.
5. `docs/RISK_REGISTER.md`를 만들어 최소 다음 위험을 기록하라.
   - Riot API key와 제품 등록
   - Vercel Hobby scheduler 한계
   - 경기 중복 정산
   - 랜덤 점수 정책 검토와 FIXED_20 fallback
   - MVP 기준 데이터 부재
   - Timeline 필드 누락
   - 주차 경계/Asia/Seoul
   - admin 권한과 개인정보
6. 실제로 결정되지 않은 사항만 `docs/OPEN_QUESTIONS.md`에 남겨라. 문서에 이미 답이 있는 질문을 다시 만들지 마라. 구현을 막지 않는 항목은 합리적 기본값을 선택하고 결정 로그에 기록하라.
7. 현재 dependency 버전 또는 외부 제약을 확인할 네트워크가 있다면 공식 primary documentation만 사용하라. 확인 날짜와 결론만 기록하고 임의 블로그를 근거로 삼지 마라.

## 완료 조건

- 현재 저장소가 빈 저장소인지 기존 앱인지 명확히 기록되어 있다.
- 세션 01~18의 순서와 dependency graph가 실행 가능하다.
- critical path와 외부 차단 요소가 구분되어 있다.
- 문서 간 충돌이 있으면 해결됐거나 명시적으로 기록되어 있다.
- 본격 기능 구현은 시작하지 않았다.

이 세션의 테스트는 존재하는 명령만 실행한다. 프로젝트가 아직 초기화되지 않았다면 명령 부재를 실패로 가장하지 말고 세션 01의 작업으로 기록하라.
