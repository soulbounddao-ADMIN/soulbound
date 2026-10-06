# FUTURE — Censorship Resistance / Operator Data-Minimization (Single-Chain ICP) — Design Notes (Northstar 후보 · NOT P0)

> **성격**: 채택된 계약이 아니라 **미래에 평가할 후보 설계의 동결 기록**. P0 계약을 바꾸지 않는다.
> **트리거 조건** — (a) RC-1/alpha 검증, (b) ICP 전환 결정, (c) JT의 명시적 결정 + 법무/커스터디 검토 — 후에만 평가/구현.
> 그 전까지는 **잠든 문서**다. 빌더는 이걸 보고 구현 시작 금지(스코프 밖, option-branch only — HARD RULE 5/6/9).
> **출처**: Opus 적대 워크플로 2건(2026-06-24) + repo 검증 @ `92783ef`. **웹검색 다운**으로 ICP 프리미티브 세부는 아키텍처 추론 — §9 fact-risk.
> **✅ 판정**: 가능하다. 단 **체인 선택이 아니라 *데이터 형태 + 키 보관 + 단일 통합 신뢰도메인*이 본질**이다.
>   목표(=영장이 운영자에게서 빈손 되게) 달성엔 **단일-ICP**가 결론. 회고적 영장은 잘 막히나 **전향적 강압엔 controller 키가 급소**.

## 1. 목표 (JT, 2026-06-24)
**수색영장이 admin(JT)/운영주체에게 집행돼도 내놓을 *관련 데이터가 없을수록* 좋다(operator data-minimization under subpoena) + 운영안정성 보장.**
검열저항을 5속성으로 분해: (A) 강압 하 *내용 기밀*(이미 강함: ciphertext-only DM·no-photo·data-min) · (B) *권위 비주권*(부분: reasonCode+events+audit+builder≠approver, 단 hash chain 미강제·service-role 비구획) · (C) *가용성/도달성*(현재 부재) · (D) *메타데이터/신원*(약함: 그래프·persona↔dossier·email↔persona 운영자 평문) · (E) *금융 동결불가*(dormant).

## 2. 체인 판정 — **단일-ICP** (grab-bag 전부 skip)
이음매(ports/adapters, `ChainReceipt`가 txRef+objectRef 보유, `LedgerChain="none"|"external"`, 플래그 HARD-false)가 frozen이라 **option-branch 어댑터 교체만으로 main 포트 시그니처 0 변경**으로 가능. 체인 선택:

| 체인 | 판정 | 이유 |
|---|---|---|
| **ICP** | **keep (home)** | 유일하게 **full-reserve 1-ICP 준비금을 네이티브 커스터디**(브리지 0, 인간 키 0) → chokepoint #1(SaaS 호스트)+#6(service-role) 동시 제거. II(email↔persona 제거)·vetKD(임계키, GA 가정)·stable-memory(삭제가능 저장)·reverse-gas. |
| zec | skip | 유일 distinct=값 은닉. 우린 결제 그래프 없음·범위 밖; 커스터디 비-native=브리지 재도입(순손실). |
| avail / Filecoin / IPFS / Arweave | skip (Filecoin류는 **HARD RULE 9로 이미 금지**) | 탈중앙 **영구·복제 스토리지 = 데이터 최소화의 정반대**(보관·가용성 *보장* = 영원히 fetch 가능) + `INV-PC-09` 삭제 위반. ICP stable-memory가 이미 off-operator + 삭제가능. |
| STRK | skip | ZK attestation-without-data는 추상적 매력이나 *데이터는 체인 아닌 DB에 있음*; 커스터디 비-native. |
| caldera | skip(net-neg) | RaaS = 네가 **시퀀서 운영 = 새 강제가능 chokepoint**. |
| NEAR | skip | 유일 관련=MPC chain-signatures(임계 크로스체인 서명). 단일-ICP엔 chain-key/vetKD가 대체 → 잉여; NEAR로 ICP 커스터디=브리지. |
| XPL / cfg / lighter / sentient / pengu | skip | 스테이블/RWA/perp/AI/NFT — 목표 기여 0, 오히려 강제가능 표면(결제 그래프·금융기록·AI 처리면) 추가. |

**메타 원리**: 체인을 더 쌓으면 거의 항상 강제가능 표면을 *더한다*. 운영자-보유 데이터를 *줄이는* 프리미티브를 가진 건 zec(값 은닉)·NEAR(임계 MPC)뿐인데 둘 다 범위 밖이거나 ICP가 네이티브 대체. → **체인 질문 종료.**

## 3. 핵심 reframe + 🔴 CRITICAL
영장엔 두 종류: **회고적**(at-rest 데이터) → 재설계로 **잘 막힘**(암호문+부패 그래프 조각+단독 무용 threshold share+이메일 매핑 없음). **전향적/강압적**("지금 ~하라") → **살아남는다**.

**🔴 CRITICAL — canister controller/upgrade 키는 오늘의 service-role 키보다 *더 나쁠 수 있다*.** 단독 admin이 controller면 영장이 **악성 Wasm 업그레이드를 강요** → 클라이언트 복호화 순간 평문/키 캡처·TTL reaper 무력화·그래프 미러링 = **클라이언트 E2E를 전향적으로 무력화하고 오늘 없는 평문을 제조**.
**필수 fix**: controller = **threshold/NNS m-of-n**(단독 인간 0 + 공개 업그레이드 제안 + timelock), **또는** crypto-critical 캐니스터 **blackhole**(불변·업그레이드 불가 — 복구성↔비강제성 트레이드). *단독 controller면 최소화 스토리 전체 붕괴.*

## 4. 운영자-보유-데이터 최소화 매트릭스
| 데이터 | 지금 영장 산출 | 목표 종단 | 기전 |
|---|---|---|---|
| **service-role 슈퍼키** | 마스터 스켈레톤 키(전 테이블 읽기+위조) | 구획화+threshold, 단일 슈퍼키 제거 | **#1 최고 레버리지 — 이거 전엔 나머지 무의미** (→ STAGE-0) |
| email↔persona | 최강 비익명화(이메일+IP) | **제거**(운영자가 이메일 미보유) | Internet Identity(앱-스코프 가명) |
| DM 내용 | 암호문(but 슈퍼키 unwrap) | 키 클라이언트/threshold → 운영자 unwrap 불가 | 기존 E2E + vetKD/Seal(복구 시) |
| **대화 그래프** | 전부(누가-누구와-언제) — 최악 노출 | 최소화/샤딩/소멸 — **온체인 금지(영구·전역=악화)** | sealed-sender + TTL reap + 관계 익명화 |
| persona↔dossier | 예(같은 id) | 입장 종결 시 dossier 파기 | clip reaper(INV-PC-09)를 텍스트로 확장 |
| audit/outbox | 평문 없음, but 행동 그래프 | per-epoch 가명 actor + TTL reap | 분쟁창 후 소멸 |
| 미래 ICP 커스터디 | (dormant) | canister-native(인간 키 0)+threshold 상환 | NNS/threshold |
| **백업** | 조용한 최악(전체 스냅샷, 미reap 포함) | threshold 암호화 + TTL 정렬 | 안 그러면 최소화가 허상 |

## 5. 없앨 수 없는 바닥 (운영안정성상 반드시 쥐는 것)
1. **도달성**(DNS/boundary node) — 어떤 체인도 못 풂; NNS+서브넷으로 *재배치*. 다중 ingress로 완화만.
2. **입장/권한 루트** — 클럽엔 문이 있다; m-of-n 분산+로깅은 되나 제거 불가.
3. **ICP 커스터디+상환 권한** — 전액준비 청구권은 본질적 *행사 가능 레버*(인간 키는 제거, 상환 함수는 잔존).
4. **라이브 운영 메타데이터** — 현재 순간 라우팅은 서버가 봄; **비보존(RAM-only·무로그)으로 과거는 소멸, 현재 순간은 불가.**

**왜 0이 불가**: 돌아가는·도달가능한·청구이행하는 클럽은 정의상 *주소지정·통치·지급능력*을 가지며 그게 강제표면. 현실 목표 = 영장이 **"읽을 것 0 · 단독 행사가능 0 · 통치되는 도달가능 endpoint가 존재한다는 사실뿐"**.

## 6. 운영안정성 균형점
**능력이 아니라 *가독성 + 단독 행사가능성*을 최소화.** 영장 산출 목표 = "단독으론 쓸모없는 조각".
- **복구**: 메시지 이력 기본 복구 불가(현 클라이언트-only 유지가 옳음). opt-in threshold 소셜복구만 — *그 사용자 한정 강제가능 표면*임을 공시.
- **모더레이션**: 능력이자 강제 레버 → 분산(m-of-n + builder≠approver + 로깅).

## 7. 단계 경로 (main은 Noop/Supabase 유지, INV-21/INV-14 리터럴 불변)
- **STAGE 0 (지금, main, 체인코드 0, 최고 ROI)**: **service-role 슈퍼키 구획화/제거 + audit hash chain 강제**(`auditHashChainEnabled=false`, 컬럼 존재). 마스터 키 살아있는 한 위 전부 한 방에 강제가능. → 별도 brief `OPERATOR_HARDENING_STAGE0_BRIEF.md`.
- **STAGE 1 (브랜치, 노력 대비 최대)**: `InternetIdentityAuthAdapter`(AuthPort) — Supabase Auth 소환 벤더 제거 + email↔persona 삭제(#5). 폭발반경 최소.
- **STAGE 2**: `CanisterStorageAdapter` + 캐니스터-타이머 outbox/reaper — 압류가능 버킷·단일 강압가능 워커 제거.
- **STAGE 3 (교정)**: ciphertext DM blob을 캐니스터로 + vetKD 키게이팅 — **단 소셜 그래프는 내구 온체인 상태 금지; 메타최소화 = 차단게이트**(온체인 이전이 INV-24 역행).
- **STAGE 4 (최대·최후·법무 HARD 게이트)**: LedgerPort 커스터디/원장/상환 캐니스터 — full-reserve·2-금고·Mint-Atomic·권력분립·fail-closed발행/fail-open상환. §4 법무검토로 차단(플래그로 못 켬). controller=threshold/blackhole(§3).

## 8. 불변식 영향: 4개 보존, 여럿 *강화*
full-reserve = 온체인 Mint-Atomic 강화 / ciphertext DM = vetKD로 "어떤 노드도 쓸 키 없음" 강화 / **builder≠approver = 캐니스터 업그레이드 권한까지 확장**(§3 critical) / **Noop-on-main 절대 보존**(@dfinity import 0, 플래그 HARD-false, icp outbox→dead_letter).

## 9. 정직한 한계 + fact-risk
- **도달성(transport) 미해결** — 클라이언트는 boundary-node 게이트웨이(icp0.io 등 유한 DNS+IP)로 접속, `*.supabase.co`처럼 차단가능. 체인은 *어디 사는지* 고치지 *도달*을 안 고침. 별도 답(미러/onion/P2P) 필요.
- **검열권력 재배치≠폐지** — 운영자 → NNS-DAO + 서브넷 노드 제공자(분산·어렵지만 0 아님).
- **대화 그래프 메타데이터** 온체인으로 안 풀림(vetKD는 키만 보호).
- **규제 분류 불변** — ICP 커스터디는 여전히 송금/전자화폐 제품(§4 게이트).
- **런타임 재작성 비용** — Next.js 서버 런타임은 캐니스터 미실행 → asset-canister SPA+백엔드 캐니스터(실 재작성) or 오프체인 SSR(작은 호스트 chokepoint 재도입).
- **⚠️ fact-risk**: vetKD GA·ICP-ledger subaccount 커스터디 API·stable-memory 영상 용량·ICRC-1/2/7·boundary-node 토폴로지·NEAR MPC 실재 = 웹다운으로 추론. **코드 착수 전 검증.**

## 10. 결론
영장 산출을 **"읽을 것 0 · 단독 행사가능 0"**까지 몰 수 있다(회고적). 단 **리터럴 0 불가**, **controller 키를 threshold/blackhole 안 하면 전향적 강압엔 오늘보다 약함**, 도달성·메타그래프·규제면역은 못 삼. 트레이드오프 = SaaS 2계정 → DAO+서브넷 신뢰집합(크지만 유계인 이득). **지금 칠 수 있는 단 하나 = STAGE 0**(체인 무관, 마스터 키 제거).
