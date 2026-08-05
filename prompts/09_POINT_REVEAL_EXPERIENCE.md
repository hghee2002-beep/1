# 세션 09 — 포인트 봉인 공개 연출

세션 08의 실제 reveal API를 사용해 승패 후 17~23점 결과를 공개하는 긴장감 있는 UI를 구현하라. 콘셉트는 카지노 가챠가 아니라 “랭크 신호 해독 / 봉인된 결과 해제”다.

## 상태 머신

다음 상태를 명시적으로 모델링한다.

- idle
- requesting
- sealLocked
- signalScan
- instability
- finalApproach
- revealed
- error
- reducedMotionReveal

애니메이션 duration은 CSS token과 테스트 가능한 clock으로 관리한다. 기본 전체 약 4.8초, 1.5초 이후 건너뛰기 허용, reduced motion은 약 0.4초다.

## 연출 구조

1. 승리/패배 결과와 봉인된 commitment 표시
2. 버튼 누르면 서버 reveal을 한 번 요청
3. 네트워크 응답을 받은 뒤에도 실제 숫자는 마지막 단계까지 시각적으로 숨길 수 있으나 DOM/ARIA에 조기 노출하지 않는다.
4. 스캔 라인, 17~23 후보 pulse, 감쇠하는 tick, 최종 숫자 lock-in
5. 승리는 `+`, 패배는 `-`를 명확히 표시
6. 최종 score 변화, 현재 순위, 재추첨 가능 여부를 함께 보여준다.

후보 숫자 애니메이션은 결과를 다시 뽑는 것처럼 오해시키지 않게 “복호화 중”으로 설명한다. 최종 숫자는 서버 값과 반드시 같다.

## 재추첨 UX

- MVP/ACE badge와 사용 기한
- “두 번째 결과가 무조건 최종이며 더 나쁠 수 있고 되돌릴 수 없음” 확인
- FIRST와 SECOND의 차이, adjustment, 최종 score 표시
- 중복 클릭/새로고침 후 동일 상태 복원

## 접근성·안전

- 소리 기본 꺼짐. 소리를 추가한다면 명시적 사용자 toggle과 짧은 자체/허용 자산만 사용한다.
- flashing/rapid strobe 금지
- `prefers-reduced-motion` 존중
- keyboard focus, dialog trap, ESC 정책
- screen reader에 진행 단계와 최종 결과를 적절히 알림
- 애니메이션 오류가 정산 오류로 보이지 않게 최종 숫자 fallback
- 1.5초 전 skip button은 disabled 이유를 접근 가능하게 제공

## 화면 연결

- `/me`의 미공개 결과 queue
- 최근 경기 행의 “결과 확인”
- participant score history의 공개 상태
- 이미 자동 공개된 결과
- reveal할 것이 없는 empty state

## 테스트

- fake timers로 상태 전환
- reduced motion
- skip 가능 시점
- network slow/failure/retry
- component unmount/remount
- repeated reveal
- server result mismatch 방지
- reroll confirmation/concurrency error
- mobile viewport와 keyboard

## 인수 조건

- 체감 긴장감은 있으나 결과 생성 시점을 속이지 않는다.
- casino/slot/현금성 표현이 없다.
- 새로고침·오류·reduced motion에서도 실제 결과를 잃지 않는다.
- animation code가 scoring domain과 분리되어 있다.

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
