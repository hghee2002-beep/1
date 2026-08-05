# 패키지 파일 Manifest

검증 상태: **SNAPSHOT — 세션 00 변경 전 원본 패키지 PASS**

> 이 manifest는 배포된 원본 패키지의 provenance snapshot이다. 2026-08-04 세션 00에서 canonical 문서와 프롬프트가 수정되었으므로 현재 작업 트리 검증값으로 사용하지 않는다. 이후 세션은 개별 canonical 파일과 `IMPLEMENTATION_PLAN.md`를 읽으며, `MASTER_GUIDE.md`와 `ALL_CODEX_PROMPTS.md`는 재생성 전까지 참고용이다.

이 표는 재생성 가능한 원본 파일만 해시한다. `ALL_CODEX_PROMPTS.md`, `MASTER_GUIDE.md`, `PACKAGE_VALIDATION.json`, `PACKAGE_MANIFEST.md`는 원본에서 생성되는 산출물이라 제외한다.

원본 파일 수: 34
원본 총 바이트: 235975

| 파일                                                       | 바이트 | SHA-256                                                            |
| ---------------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `AGENTS.md`                                                |   8921 | `edfa66285331210b6205501a0389c4a4ceab11d9053ede2c93f8df9ceb0214dc` |
| `PACKAGE_REVIEW.md`                                        |   5578 | `d521efea9fc297af8d234fe75ec7d162dc4d177cf7387ddd66543fe9ff2d3ce3` |
| `PLANS.md`                                                 |   2909 | `a13ddd61d60c719fc5e89ae23a49dd8ab41a256bed29d0ea35df2e2ffcb857b3` |
| `README_FIRST.md`                                          |   8284 | `f993126c4ff8c616388962c2d1cb556bca4fb8cfc9345509774e07c5ad31c1b7` |
| `docs/ARCHITECTURE.md`                                     |  15300 | `22ad5bc0fddd20ec21b0b6db36d3c151afc6f7671699382962d6d42e9aacd16c` |
| `docs/DATA_MODEL.md`                                       |  19342 | `0301defb6e670d78a90259b24a2ee7706e22ebede9572118744e0f0e70112360` |
| `docs/DECISIONS.md`                                        |  10068 | `e34a89a7db23801accee8b98fde1c000ebde83dab2ba0410e98614e2856d9f7b` |
| `docs/EXTERNAL_CONSTRAINTS.md`                             |   7995 | `23276bdf9d0040e8e60d5b634692a82ec7f9d6eca17e1e99b4a32259b3400576` |
| `docs/MISSION_CATALOG.md`                                  |  18895 | `6fc070359886f3efef267ebe9ae33072b024225b988c1ebc953e1b0872fb6ced` |
| `docs/PRD.md`                                              |  25471 | `83b9354f05ece11268a26bc8a18abf46480303f0625883b12e26374226448a79` |
| `docs/RUNBOOK.md`                                          |  10210 | `b67b3295ec916222d9b34b822a3020b4e9a532870d6c1534527eb6630956c1d5` |
| `docs/TEST_PLAN.md`                                        |  10474 | `1ae504c2779e8160eb59c498d727ccd071858bce3d5a7e4919ab0c77f139f19f` |
| `prompts/00_REPOSITORY_AUDIT_AND_PLAN.md`                  |   2743 | `e98285be907b9f745c8379108c9d15b69ac889ec2d0b28803d4cfa2545943828` |
| `prompts/01_FOUNDATION_AND_TOOLING.md`                     |   4515 | `dd609942bdb57219218f9ba9e15137ff7dc9923a2d24e66e0503f2ea5ebe8fcd` |
| `prompts/02_DATABASE_SCHEMA_AND_SEED.md`                   |   4691 | `2556969530c94bbfe6849a5b6b603f3d65078fee024cd24d8a2a5e896758cf63` |
| `prompts/03_DESIGN_SYSTEM_AND_STATIC_UI.md`                |   5182 | `ed7b0843a412af7abf72cddf97645d5ec704edec3a770a6424ecdf568b39183a` |
| `prompts/04_AUTH_AND_AUTHORIZATION.md`                     |   3856 | `f0f4230b1f95a3ef918fdb90e39d2bd30ea375374156178868e5b11ce4144c40` |
| `prompts/05_RIOT_APPLICATION_AND_APPROVAL.md`              |   4154 | `20bb77508e3aac1394207ee7136d8ff5375eafe77b303b4264ad2fe536a9a6f5` |
| `prompts/06_RIOT_CLIENT_AND_MOCK.md`                       |   4017 | `9eb2dd1f6f41441ee7a3981b8a9fbc547d55da1b642ba532d41e658806ddc9e0` |
| `prompts/07_MATCH_SYNC_AND_RANK_SNAPSHOTS.md`              |   4697 | `329c8e189ccc839482397a00e841d991455ade8819b915bdebc3e90dafa13fcd` |
| `prompts/08_SCORING_LEDGER_AND_REROLL.md`                  |   4737 | `df83133e6aa7e8773dc083752530858b079da8cb71a97a60287d98c85a50ae84` |
| `prompts/09_POINT_REVEAL_EXPERIENCE.md`                    |   4432 | `adb13986cfbc6155c6e16a0e557ace79b0f057ca43060b70e935a4abd45221b0` |
| `prompts/10_MVP_ACE_ENGINE.md`                             |   4612 | `e497eb3652e81344565c41ba8fb33f059bb2e421452f344f425b0084a16d5a88` |
| `prompts/11_MISSION_ASSIGNMENT_ENGINE.md`                  |   4508 | `13878aac6bfdab2d2f2224525ffc46021b9708cb2d2db1bf3f364e744ab8ee8e` |
| `prompts/12_MISSION_EVALUATORS_MATCH_AND_OBJECTIVES.md`    |   4299 | `9b7974253d1ad6b085382b0ab5c3fca024d192e07a035e29165bf01d8056e28a` |
| `prompts/13_MISSION_EVALUATORS_TIMELINE_AND_CUMULATIVE.md` |   4343 | `9583307e9da9d6b7254d1cafae3e8ac9ed75ae0f2cc5358f6a21f4d84d0d1915` |
| `prompts/14_DASHBOARDS_LEADERBOARDS_AND_HISTORY.md`        |   4472 | `f19619a891bbc76dc6b944d50c40bf5fcd0399b70dda7efa1ac1fdce8878db3c` |
| `prompts/15_ADMIN_CONSOLE.md`                              |   4402 | `0b7ef9bea86e6e54bcf7dc6db2e19c026d4ddc6763b19b0535cb4c1eae30116b` |
| `prompts/16_SCHEDULER_REFRESH_AND_OBSERVABILITY.md`        |   4262 | `bae2c854e3981516e457b94215bae650350ba7e30d9fd16451014444a6bfe70a` |
| `prompts/17_SECURITY_QA_AND_RELEASE.md`                    |   4163 | `7c1aa18f8574e532d85cf6f6712faafbddcfc7903c7ba108420dce640727a231` |
| `prompts/18_FINAL_PRODUCTION_AUDIT.md`                     |   4443 | `244d12ca22b7ed4f5c1adddecd6c65035b59813bb10fe3f839933caa5714bbd7` |
| `prompts/MASTER_FULL_BUILD_ATTEMPT.md`                     |   3330 | `57e5032bfa8580f9ef05173c3f154215ccb03b6fe2219e6b53f936c91ab4d862` |
| `prompts/ONE_SHOT_VISUAL_PROTOTYPE.md`                     |   5859 | `f02fc7d625fbd28964b665c2c65cf00d063647bcbce73c9552be900af302df8b` |
| `prompts/START_HERE.md`                                    |    811 | `3aeb30296f2e13469d5e69cff174ab65940b9ad962bdc8d2d9689dac1b7218c4` |
