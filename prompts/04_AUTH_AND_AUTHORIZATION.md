# 세션 04 — Credentials 인증, 세션, 권한

사이트 자체 `loginId + password` 인증과 USER/ADMIN 권한을 production-grade로 구현하라. Riot 계정 연결은 다음 세션이며, 이 세션에서는 일반 계정과 보안 경계를 완성한다.

## 구현 범위

- 회원가입: loginId, password, password confirmation, display name, 약관 동의 version
- loginId 정규화와 허용 문자/길이 정책
- Argon2id hash와 안전한 parameter 설정
- 로그인, 로그아웃, 현재 세션 조회
- 서명된 JWT에는 최소 정보와 opaque session ID만 두고 `AuthSession` DB 상태로 revoke/expiry를 확인한다.
- HttpOnly cookie, production Secure, SameSite=Lax, 명확한 max age
- 세션 rotation과 logout revocation
- USER/ADMIN server-side guard
- `/me`, `/admin/*`, auth 페이지 redirect 정책
- 관리자 생성은 공개 endpoint가 아닌 `pnpm admin:create` CLI로 제공
- 로그인 실패 기록, generic error, rate limit/lockout 정책
- 상태 변경 route/server action의 origin 또는 CSRF 검증
- audit log가 필요한 관리자 권한 변경 서비스 경계

## 금지

- localStorage token
- 평문 비밀번호 또는 복호화 가능한 저장
- middleware만 믿는 관리자 권한
- client가 role을 보내면 신뢰하는 처리
- hard-coded production admin password
- secret 기본값으로 production 부팅

## UI 연결

- 세션에 따라 navigation과 CTA를 바꾼다.
- field-level validation과 접근 가능한 오류 요약을 제공한다.
- redirect query는 same-origin safe path만 허용한다.
- 가입 후 자동 로그인 여부는 `docs/DECISIONS.md`에 기록하고 일관되게 적용한다.

## 테스트

- signup/login/logout 성공
- 잘못된 credential의 동일한 외부 오류
- duplicate/정규화된 loginId
- hash 검증
- 만료·변조·revoke session
- USER의 admin route/API 차단
- rate limit
- CSRF/origin
- cookie attributes

## 인수 조건

- 브라우저 새로고침과 server component에서 인증 상태가 일치한다.
- 비밀값과 hash가 로그·응답에 노출되지 않는다.
- 관리자 mutation은 각 endpoint/service에서 재검증된다.
- E2E로 가입→로그인→보호 페이지→로그아웃이 통과한다.

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
