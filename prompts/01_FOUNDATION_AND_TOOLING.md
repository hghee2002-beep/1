# 세션 01 — Next.js 기반과 개발 도구

빈 저장소라면 production-grade Next.js App Router 프로젝트를 초기화하고, 기존 프로젝트라면 명세와 충돌하지 않게 기반을 정리하라. 이 세션의 목표는 이후 모든 기능이 일관된 구조·명령·검증 위에서 개발되게 하는 것이다.

## 구현 범위

- pnpm workspace가 아닌 단일 앱을 기본으로 한다. 기존 monorepo라면 구조를 존중한다.
- Next.js App Router, TypeScript strict, `src/` 구조, Tailwind CSS를 설정한다.
- shadcn/ui와 lucide-react를 사용할 준비를 하되 불필요한 전체 컴포넌트를 복사하지 않는다.
- Recharts, Prisma/PostgreSQL client, Argon2id, JWT 서명 라이브러리, Zod, Vitest, React Testing Library, Playwright에 필요한 안정 패키지를 설정한다.
- 현재 시점의 안정 GA 버전을 공식 문서와 peer dependency로 확인하고 lockfile에 고정한다. beta/canary를 사용하지 않는다.
- import alias, strict compiler option, server-only 경계, 환경 변수 schema validation을 구성한다.
- `.env.example`을 `docs/RUNBOOK.md`와 일치시킨다. 실제 secret은 넣지 않는다.
- 공통 `src/app/layout.tsx`, error/not-found/loading 경계, 기본 metadata, health route를 만든다.
- `src/lib/env/server.ts`와 필요한 public env 모듈을 분리해 server secret이 client import될 수 없게 한다.
- ESLint/formatting 정책, Vitest setup, Playwright config, test DB를 위한 문서·스크립트 골격을 만든다.
- `package.json`에 `dev`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build`, `check`, Prisma 관련 명령을 제공한다.
- GitHub Actions CI를 추가해 install → lint → typecheck → unit test → build를 수행한다. DB가 필요한 단계는 명시적 service/환경을 사용하거나 후속 세션까지 조건부로 둔다.
- 루트 README를 만들어 Windows 11을 포함한 로컬 실행 순서, Mock 모드, 환경 변수, 테스트 명령을 설명한다.

## 구조 원칙

- `src/app`, `src/components`, `src/features`, `src/domain`, `src/server`, `src/lib`, `prisma`, `tests`의 책임을 문서화한다.
- client component는 꼭 필요한 곳에만 `'use client'`를 붙인다.
- 빈 페이지마다 임시 lorem ipsum을 대량 생성하지 않는다.
- 현재 세션에서는 실제 인증, Riot 호출, 점수, 미션 로직을 구현하지 않는다.

## 인수 조건

- 새 clone에서 문서의 명령으로 설치·개발 서버·품질 검사에 진입할 수 있다.
- 잘못된 필수 환경 변수는 시작 시 안전한 오류를 내며 secret 값을 출력하지 않는다.
- client 코드가 server env 모듈을 import하면 빌드 또는 lint 경계에서 차단된다.
- 기본 페이지와 `/api/health`가 동작한다.
- 최소 1개 unit test와 1개 Playwright smoke test가 실제로 실행된다.

## 공통 실행 규칙

- 저장소 루트의 `AGENTS.md`와 이 작업에 관련된 `docs/` 문서를 먼저 읽어라.
- 현재 저장소를 조사하고 이미 올바르게 구현된 부분은 보존하라.
- 시작할 때 5~12개 항목의 구체적 실행 계획과 영향 파일을 제시한 뒤, 계획만 말하고 멈추지 말고 구현까지 진행하라.
- 안전한 로컬 파일 수정, 패키지 설치, migration 생성, 테스트 실행은 수행해도 된다.
- Git push, 외부 배포, production DB 변경, 유료 리소스 생성, 실제 secret 변경은 하지 마라.
- 외부 자격 증명이 없으면 Mock과 adapter 경계까지 완성하고, 실제 연동이 끝났다고 가장하지 마라.
- 타입 오류를 `any`, 무분별한 assertion, lint 비활성화로 숨기지 마라.
- 구현이 명세 결정을 바꾸면 같은 change에서 `docs/DECISIONS.md`를 갱신하라.
- 현재 세션 범위를 넘는 대규모 기능은 만들지 말고, 필요한 interface와 후속 TODO만 명확히 남겨라.

## 종료 전 검증 및 보고

가능한 범위에서 다음을 실행하라.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

DB 또는 주요 사용자 흐름을 다룬 세션은 관련 integration/E2E 테스트도 실행하라. 마지막 응답에는 다음을 포함하라.

1. 구현 결과와 핵심 결정
2. 변경 파일
3. 실행한 명령과 성공/실패 결과
4. 추가한 테스트와 검증한 경계 사례
5. 실행하지 못한 항목과 정확한 이유
6. 남은 외부 의존성 또는 리스크
7. 추천 Git commit message
