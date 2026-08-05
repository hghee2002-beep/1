# 실제 미결정 사항

기준일: 2026-08-04

아래에는 기존 결정·PRD·아키텍처에 답이 없는 운영자 입력 또는 외부 확인만 남긴다. 구현 세부사항은 질문으로 미루지 않고 `docs/DECISIONS.md`의 기본값을 따른다.

| ID | 결정이 필요한 질문 | 현재 기본값/중단 조건 | 필요한 시점·소유자 |
|---|---|---|---|
| Q-001 | production hosting, PostgreSQL provider, domain, scheduler plan, backup/restore 정책은 무엇인가? | 세션 01~16은 로컬 PostgreSQL+Mock+MANUAL/GitHub schedule adapter까지 진행한다. 외부 리소스를 임의 생성하지 않는다. provider snapshot과 restore rehearsal이 없으면 Stage 2를 시작하지 않는다. | 세션 17 전 / 운영자 |
| Q-002 | 첫 시즌의 정확한 참가자 수, 시작·종료 시각, 1주/2주 구성, 중도 참가 허용 기준은 무엇인가? | schema와 관리자 UI는 설정 가능하게 만든다. D-022에 따라 공식 정책 재확인 전 최소 20명을 적용하고, 진행 중 승인은 예외 사유·시작 snapshot·AuditLog 없이는 차단한다. | staging 운영 리허설 전 / 대회 운영자 |
| Q-003 | 적용 지역의 최신 Riot 커뮤니티 대회 정책 원문, 별도 신청/제출 양식, 제품 등록 상태와 production/personal key 유형은 무엇인가? | 확인 가능한 공식 URL·확인일·결론이 없으면 공개 실 API 운영을 차단한다. 개발은 Mock으로 계속한다. | 제품 등록 및 개최 전 / 운영자 |
| Q-004 | 국내 적용 법률·Riot 정책 검토 후 본 운영 점수 모드는 `RANDOM_17_23`인가 `FIXED_20`인가? | 검토 완료 전 데모는 RANDOM을 표시할 수 있으나 실제 보상·본 운영 기본은 `FIXED_20`으로 둔다. 유료 재추첨·현금·환전·베팅은 어떤 결론에서도 금지한다. | 시즌 규칙 게시 전 / 운영자·필요 시 법률 검토자 |
| Q-005 | 실제 MVP/ACE baseline의 출처, tier coverage, 최소 표본 수, metric별 허용 누락률은 무엇인가? | `DEMO_ONLY` fixture만 사용하고 production entitlement는 차단한다. baseline이 없는 티어는 `PENDING_BASELINE`; 임의 근접 bucket 매핑은 하지 않는다. | 세션 10 구현 후 Stage 2 전 / 데이터 소유자 |
| Q-006 | 이용약관·개인정보처리방침의 최종 문구, 계정·raw Riot payload·세션·AuditLog·export의 보존 기간, 삭제 문의 담당은 누구인가? | 세션 04/15는 versioned LegalDocument/LegalConsent와 configurable retention 연결점까지 구현한다. 최종 문구와 기간이 없으면 공개 가입과 production export를 차단한다. | 공개 가입 전 / 개인정보 담당자 |
| Q-007 | 참가비·상금·스폰서·방송이 실제 행사에 존재하는가? | 코드에는 금전 기능을 추가하지 않는다. 하나라도 존재하면 적용 법률·세무·Riot sponsor/prize 규칙을 별도 검토하기 전 이벤트 시작을 차단한다. | 규칙 공지 전 / 대회 운영자 |

## 이미 결정되어 다시 묻지 않는 항목

- 기술 스택과 pnpm 단일 앱, KR/ASIA routing, PUUID 기준 식별자
- `Asia/Seoul` 표시와 UTC 저장, `[startAt,endAt)` 경기 경계
- 점수 즉시 정산과 공개 분리, append-only ledger, 재추첨 최대 1회
- 주차당 활성 미션 5개, 6시간 보충 최대 3, 1시간 리롤, 경기 시작 snapshot
- Credentials 인증, Argon2id, HttpOnly cookie, server-side RBAC
- 실명 공개 opt-in 기본 false, DEMO_ONLY 보상 차단, Vercel Hobby Cron 비사용
