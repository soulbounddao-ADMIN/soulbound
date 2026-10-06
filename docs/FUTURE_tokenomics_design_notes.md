# FUTURE — SOUL / BOUND Tokenomics Design Notes (Northstar 후보 · NOT P0 계약)

> **성격**: 채택된 계약이 아니라 **미래에 평가할 후보 설계의 동결 기록**이다.
> P0 계약(`docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md`)을 바꾸지 않는다.
> **트리거 조건** — (a) RC-1/alpha 검증, (b) ICP 전환 결정, (c) JT의 명시적 토큰경제 도입 결정 — 셋이 모두 충족된 뒤에만 평가/구현.
> 그 전까지는 **잠든 문서**다. 어떤 빌더도 이걸 보고 구현 시작 금지(스코프 밖).
> **출처**: Opus Layer-3 감사(2026-06-23) + 적대 검토(2026-06-23) + **JT 모델 확정에 따른 판정 정정(2026-06-24)**.
> **사실 스냅샷 commit-pin**: `4d7f99e`(origin/phase1-p0-mvp).
> **✅ 판정(2026-06-24 정정)**: JT가 확정한 **전액준비(full-reserve) 수량-peg escrow 모델**은 *경제적으로 건전*하다.
>   초기 적대 검토의 "UNSOUND AS-SPECIFIED"는 *다른 모델*(USD-target 상환 크레딧 + 준비금 가용)을 가정한 것이라 **철회**한다.
>   남는 위험은 **경제가 아니라 구현·커스터디·권한**(무담보 발행/준비금 유용/커스터디 침해/부당 슬래싱/상환실행 실패)이다.
> **명칭**: 보상 토큰 SOLU → **BOUND**(SoulBound = SOUL + BOUND).

## 1. 확정 모델 (JT, 2026-06-24) — 전액준비 책임담보 청구권

핵심 한 줄:
> **SOUL은 1 ICP와 수량 기준으로 완전히 본딩된 전액준비형 책임담보 청구권이며, 최종 슬래싱으로 소멸한 청구권에
> 대응하는 ICP는 사용자 준비금에서 분리되어 SoulBound 프로토콜의 영구 운영담보금으로 귀속된다.**

- **SOUL** = 1 ICP **수량** 청구권(USD 아님). 1 ICP 입금이 최종 확정돼야 1 SOUL 발행, 그 ICP는 상환 전까지 손대지 않음.
  - 용도: 스테이킹 / 책임행위(reputation stake). **준비금에서 빼서 쓰는 소비 크레딧이 아니다.**
  - SOUL은 **슬래싱으로만 소멸**한다. 소멸 = 사용자의 ICP 상환청구권 소멸, 대응 ICP는 프로토콜 담보로 귀속.
  - 따라서 `treasury_ICP >= redeemable_SOUL`는 **구조적으로 항상 성립**하고, 슬래싱 누적 시 **담보비율은 단조 증가**.
  - **왜 ICP 가격 하락이 무해한가**: 부채가 USD가 아니라 ICP 수량이라 자산·부채가 같이 움직인다 → 불일치 0. 스테이블코인이 아니라 **ICP 표시 전액준비 보관증**.
- **BOUND** = SOUL **스테이킹 보상**으로 발행되는 별도 원장 토큰. **ICP reserve와 완전 분리**(준비금 미접촉·비상환·SOUL 교환불가).
  hype류 토크노믹스(fee-buyback/burn 등 실 sink)에 따라 SoulBound 내부에서 소비. **§3의 BOUND 불변식 필수.**

### 초과담보 수치 예시
```
초기:    예치 ICP 100 | redeemable SOUL 100 | 담보비율 100%
SOUL 10 최종 슬래싱 후: 보유 ICP 100 | redeemable SOUL 90 | 프로토콜 담보 ICP 10 | 담보비율 111.1%
누적될수록:  총 ICP ≥ redeemable SOUL  →  지급불능 가능성은 오히려 감소
ICP $100→$1 폭락:  돌려줄 의무 = 1 SOUL당 1 ICP, 보유자산 = 동일 수량 ICP  →  자산·부채 불일치 없음
```

### 상환 흐름 (1개월 = 유동성 확보 아님, 보안·분쟁확정·정산 기간)
```
상환신청 → 해당 SOUL 즉시 redeem_pending lock(available↓, redeem_pending↑)
        → 보안/분쟁확정/정산 기간(정상 1~7일, 분쟁·슬래싱 관련 최대 30일; 30일은 최대치지 자동대기 아님)
        → 지정 월렛으로 ICP 지급 → 지급 최종확인 → SOUL 영구 burn
(지급 실패 시 redeem_pending 복구/재지급은 상태기계로)
```
유예의 의미: 도난·부정취득 검토 / 진행 중 slash case 확인 / 항소·분쟁 finality / 출금주소 변경공격 방지 / 대량상환 / AML·법무.
정상 상환을 운영자가 임의로 30일 붙잡는 구조는 신뢰를 깎으므로 **정상/분쟁 트랙을 분리**한다.

### 슬래싱 → ICP 귀속 (최종확정 전 재분류 금지)
```
slash 제안 → 대상 SOUL lock → 증거·결정문 기록 → 항소기간 → 최종확정
          → SOUL burn → 대응 ICP를 backing reserve에서 protocol collateral로 재분류
```
**핵심**: 최종확정(항소 종료) 전엔 ICP를 담보로 재분류 금지(번복 대비). slash는 곧 재산손실이므로 인접 권한은 엄격 분리(§3).

### 두 금고 분리 (물리적으로 같은 계정이어도 장부상 분리)
- **Backing Reserve** = 현재 redeemable SOUL을 담보하는 ICP. **절대 사용 불가**: 운영비·개발비·BOUND 보상·투자·스테이킹·대출·유동성공급·적자보전.
- **Protocol Collateral** = 최종 슬래싱된 SOUL 대응 ICP(더는 사용자 청구권 아님). 권장 우선순위: ① 피해자 보상 ② 분쟁·보안사고 보험기금 ③ 지급보증 완충금 ④ 제한된 운영비.
  슬래싱 자금이 운영자 일반매출로 직행하면 **과잉 슬래싱 유인** → 운영법인 수입과도 분리된 프로토콜 보험·담보 treasury로 둔다.

### 목표 아키텍처 (권한 분리가 핵심)
Treasury/Reserve(2-금고) · SOUL Ledger(ICRC 지향) · Policy/Tokenomics Controller(**단일 권한 금지 — §3 분리**) ·
Staking · BOUND Ledger(분리·비상환) · Reward/Redemption Execution.

## 2. 현재 repo 상태 (Opus Layer-3 감사 @ `4d7f99e`)

**판정: 지금 구성 불가(NOT READY) / 미래엔 net-new Layer 3로 가능.** 결함이 아니라 §3.1/§3.3의 **의도된 동결 상태**.

**실재(전부 dormant · schema-only · 발행 0):**
- `0002_schema_only_tables.sql`: `soul_balances`(available/locked numeric, ledger_balance_ref), `soul_ledger_events`(append-only, `event_type` **free text**, amount, idempotency_key unique), `slash_cases`(draft/open/decided/appealed/closed, **amount 컬럼·balance FK 없음**), `decision_receipts`(decision_hash, `appeal_deadline` **nullable**), reports/evidence_files/emergency_actions/user_intent_authorizations.
- `ports/ledger-port.ts` + `domain/ledger/types.ts`: CONTRACT-FROZEN, NoopLedgerAdapter ONLY(INV-21), `issueActivationStake` "NOT reward, NOT airdrop, **never freshly minted**"(grantSoul에서 rename — naming-as-guardrail 선례).
- `noop-ledger-adapter.ts`: 전부 `{chain:"none", status:"skipped"}`. `feature-flags.ts`: `externalLedgerEnabled:false` HARD.

**전무(미래 net-new):** ICP 플랫폼(canister/ICRC) · Treasury/Reserve 회계 · BOUND 일체 · burn/slash의 liability·ICP 연결 · staking reward · 권한 분리 게이트키퍼.

## 3. 핵심 불변식 (검토 도출 — "원칙"이 아니라 코드·DB 제약으로)

> 이 모델은 경제적으로 건전하지만, **그 건전성 전체가 아래 불변식의 강제 여부에 달려 있다.** 하나라도 산문에 그치면
> 무담보 발행/준비금 유용/부당 슬래싱이 곧 사용자 손실이 된다.

### 3.1 준비금·발행·상환 (JT INV-S 시리즈)
- **INV-S1** redeemable SOUL 총량 ≤ 사용자 backing reserve ICP 수량.
- **INV-S2** SOUL은 최종 확정된 ICP 입금 없이 발행 불가.
- **INV-S3** 하나의 ICP 입금 참조는 최대 1회만 SOUL 발행에 사용(`deposit_block_index` 등 고유참조 **unique constraint**).
- **INV-S4** backing reserve ICP는 SOUL 상환 이외 용도 사용 불가(2-금고 격리).
- **INV-S5** 상환 신청된 SOUL은 즉시 lock — 전송·스테이킹·재상환 불가.
- **INV-S6** ICP 지급 최종확정 시에만 대응 SOUL 영구 소각.
- **INV-S7** 슬래싱된 SOUL 대응 ICP는 슬래싱 **최종확정 후에만** protocol collateral로 재분류.
- **INV-S8** 항소·분쟁 중 SOUL 대응 ICP는 backing reserve에서 제외·지출 불가.
- **INV-S9** BOUND의 발행·가치·보상은 SOUL **공급량·소각량·ICP 준비금·슬래싱 ICP와 독립**(준비금 미접촉).
- **INV-S10** 보유 총 ICP는 backing reserve + protocol collateral로 완전 분류.

**발행 흐름(고정)**: ICP 입금 제출 → ICP Ledger 최종확인 → deposit 중복사용 확인 → reserve 귀속 → 동일 수량 SOUL 발행 → deposit reference `consumed`. *SOUL 선발행·ICP 후확인 금지.* `deposit_ledger`(block_index/from/amount/confirmed_at/consumed_at/minted_soul/mint_event_id).

**최상위 감사식(매 epoch 검증):**
```
total_custodied_ICP = user_backing_reserve_ICP + finalized_protocol_collateral_ICP
                    + pending_unallocated_deposits_ICP − pending_confirmed_payouts_ICP
user_backing_reserve_ICP ≥ redeemable_SOUL + redeem_pending_SOUL + slash_appeal_pending_SOUL
```
(항목은 정확한 상태정의에 맞춰 조정; 의도는 불변.)

### 3.2 권한 분리 (= 이 모델의 최대 위험. builder≠approver의 돈 버전)
단일 행위자가 reserve 임의출금 / 무담보 mint / 임의 slash / 상환거부 / 출금주소 변조 / 무-finality ICP 이전 중 하나라도
가능하면 위험. **반드시 분리**: SOUL mint(입금증명 검증 자동로직만) · ICP reserve custody(threshold multisig/canister) ·
slash 제안(Court/Policy) · slash 실행(**appeal finality receipt 있어야만**) · redemption 실행 · policy 변경(즉시적용 금지·timelock).
- **Inv-SEPARATION-OF-POWERS** 제안자 ≠ finalizer/approver; liability/자금 영향 실행은 timelock.
- **Inv-CIRCUIT-BREAKER** M-of-N guardian 동결 — 단 **기백킹 SOUL 상환은 가두지 않음**(발행 fail-closed, 백킹 청구 honoring fail-open). `emergency_actions.review_required` 코드 강제.
- **Inv-RECONCILIATION** Supabase 원장 sum(redeemable SOUL) vs 격리 reserve를 ICP 정산체인과 주기 대사; drift/오라클 staleness 시 mint fail-closed.
- **Inv-SLASH-NOT-PROFITABLE** slash 실행자/판정자는 slash로 직접 이득 없음(slash ICP는 분리 treasury·운영자 매출 직행 금지).
- **Inv-MINT-ATOMIC** mint는 특정 chain-final deposit에 unique FK + crash-safe outbox/saga(확정 백킹 없는 mint 행 금지).
- **Inv-REDEEMABLE-DISCRIMINATOR** 모든 balance/event에 redeemable-vs-Activation(non-redeemable) 하드 판별자; reserve 요건 = redeemable(available+locked) 전부.

### 3.3 BOUND 토크노믹스 (HYPE 차용 · v1.1) — SOUL 스테이킹 보상 토큰

> HYPE에서 차용: **무VC 커뮤니티 우선 분배 · 실수익 buyback-burn 플라이휠 · 하드캡+양방향 sink ·
> stake-to-use 결합 · 고정 풀에서 감쇠 발행.** HYPE의 fee→buyback→burn 구조를 차용하되 SoulBound는 hold/reserve
> 단계 없이 **명시적 buyback-burn으로 단순화**; 38.9% reserve 대신 12% emission(미니멀). 적대 스트레스 3건(farm front-load·저수익 인플레·규제/증권성) 패치 통합.
> BOUND은 SOUL *스테이킹*에 비례하므로 SOUL과 **수요 결합이 존재한다**(="완전 독립"은 부정확). 솔벤시에 중요한 건
> **ICP 준비금과의 분리**뿐이고, 그것만 지키면 BOUND→0은 *질서있는 unstake*(bank run 아님)다.

**총량/배분 — 100,000,000 BOUND 하드캡(불변, HYPE 1B의 1/10 = 사적 클럽):**
12% staking emission(유일 발행경로) · 20% 승인멤버 인정 에어드랍(**선형 tenure** 가중 — *자본 아닌* admission 일수 비례,
반편향 유지; 단 최초 멤버에 비례 집중 = final-club 시니어리티 성질) · 23% treasury(다년 vest) · 20% team(1y cliff+3y vest) ·
10% buyback-burn buffer · 15% strategic reserve(timelock).
**VC/사전판매 0 · ICP 표시/백킹 배분 0** → 수수료 100%가 토큰으로 환류.

**발행 비율 (SOUL 스테이킹 → BOUND):**
```
EPOCH = 1주(52/yr). unstake cooldown = 테뉴어 스케일 2→8 epoch (>1 epoch, JIT 차단).
고정 12M 풀, 확정 10년 half-life(520 epoch):  d = 0.5^(1/520) ≈ 0.998668
E_1 = 12,000,000 × (1−d) ≈ 15,985 BOUND/epoch,  E_n = E_1·d^(n−1)   (무한 geometric tail; 합은 12M에 점근 수렴 — 구현은 dust cutoff(E_n<ε epoch 종료, 잔여 풀 treasury) 또는 terminal epoch로 고정)
누적: ~6.7% yr1 / 13% yr2 / 29% yr5 / 50% yr10.  yr1 총발행 ≈ 804,000 BOUND. (스카시티 우선 — 극저 인플레.)
per-staker:  stake_seconds_i = ∫_epoch staked_SOUL_i(t) dt   (적분, 스냅샷 아님)
             reward_i = mint_n × stake_seconds_i / Σ_j stake_seconds_j
비율 = E_n / total_staked_SOUL (1인당 자동 희석).  locked/slash-pending/appeal-pending/redeem-pending SOUL = 0 weight.
```
| 총 stake | epoch-1 BOUND/SOUL | year-1 BOUND/SOUL |
|---|---|---|
| 5,000 | 3.20 | 160.8 |
| 20,000 | 0.80 | 40.2 |
| 50,000 | 0.32 | 16.1 |
| 100,000 | 0.16 | 8.04 |
| 200,000 | 0.08 | 4.02 |

(burn 저조 구간엔 throttle floor 0.4× → 위 ×0.4. 예: 총 20k staked, 내 200 SOUL=200 ICP 풀 락 → share 1% → epoch-1 ≈ 160 BOUND; 마지막 20%만 stake → 적분 share ≈0.2% → 1/5.)

**throttle (확정: 게이팅 없음, k_n=0.4 고정)**: `mint_n = min(E_n, 0.4·E_n + trailing_4ep_avg_burn)`.
수익 게이팅 없이 floor 40% 항상 발행, burn 높으면 E_n까지. `min(·,E_n)`이 절대 천장(공격입력에 안 스케일). 거버넌스는 E_n을 **down만**.
**⚠️ 잔여(적대 검토 stress#2)**: 수익 게이팅이 없어 저/무수익 클럽도 0.4·E_n을 계속 발행 → **lifetime ≤ 4,800,000 BOUND(캡의 ≤4.8%) 유계 경미 인플레, deflationary crossover 없음.** 10년 감쇠라 매우 느림(무수익 yr1 ≈ 322k). R_min 캘리 불가로 *단순성 트레이드오프 수용*. **공시 필수**: 저수익 시 deflationary 아님. 출시 때 수익 신호 생기면 R_min 게이팅 재도입 여지.

**sink + net 궤적:**
- **1차(내생)**: 모든 유료 기능 fee를 BOUND로 받고 **100% burn**(fiat auto-convert-and-burn 폴백).
- **2차(HYPE AF식 fee→buyback→burn 차용)**: 순수익 **60/30/10 고정** — 60% **buyback-burn** / 30% BOUND 표시 보험버퍼 / 10% opex. **ICP 준비금·slashed-ICP 미접촉.**
  **⚠️ opex 의존성**: 작은 초기 수익의 10%로는 운영비 부족 → **초기 운영은 수익이 아니라 treasury(23%)/team allocation에서 충당**(이 의존성 명시). 대신 day-1 강한 burn = 가치누적 최대.
- **baseline**: **10% buyback-burn buffer에서만** 최소 burn floor(30% insurance buffer는 burn 금지 — Inv-BOUND-INSURANCE-SEGREGATED) + sink-coverage 서킷브레이커(burn/emission 저조 K epoch 지속 시 감쇠 가속).
- **궤적(10년 half-life)**: emission이 극히 낮아(yr1 ≈ 804k) **burn이 emission을 넘을 만큼 수익이 충분하면 crossover가 비교적 쉽다** → net deflationary.
  **단 저수익이면 crossover 없음**(게이팅 없어 0.4·E_n 계속 발행, lifetime ≤ 4.8M 유계 경미 인플레 — 매우 느림). **"즉시/저수익 deflationary로 마케팅 금지."**

**anti-gaming:** 시간적분 · 테뉴어 스케일 cooldown · **보상 4-epoch 선형 베스팅**(조기 unstake 시 미베스팅 forfeit→풀) ·
tenure multiplier 1.0→1.5(unstake 리셋, sybil-invariant) · **ICP 1:1 sybil 바닥**(stake엔 실물 ICP 락) · `Σ reward_i ≤ mint_n ≤ E_n` 온렛저 강제.

**value-accrual:** usage→burn 플라이휠 + stake-to-use(staked-SOUL 티어가 BOUND 표시 혜택: fee 할인/Review-Toll 권한/크레딧/언락) +
capital+time-gated. **ICP reserve 청구권 아님** — BOUND 가치 = SoulBound 자체 수익흐름의 할인가치 + burn 희소성.

**BOUND 불변식:**
- **Inv-BOUND-CAP** 최대 100M, 불변. burn은 영구·below-cap(천장 재크레딧 금지).
- **Inv-BOUND-NONREDEEMABLE** ICP·SOUL로 상환·교환 불가; 유일 outflow = spend-and-burn.
- **Inv-BOUND-NO-RESERVE-DRAW** emission/E_n/throttle/buyback/보상 어느 것도 **두 ICP 금고(backing reserve + protocol collateral)**·SOUL 공급·SOUL burn에서 산정·재원 안 함(INV-S9 확장).
- **Inv-BOUND-CAP-ABSOLUTE** E_n 고정 거버넌스 스칼라; mint_n은 stake/price/revenue/공격입력에 절대 up-scale 안 됨; 거버넌스는 down만.
- **Inv-BOUND-TIME-INTEGRATED** 가중 = ∫ staked_SOUL dt(SOUL-초), 스냅샷 금지.
- **Inv-BOUND-COOLDOWN** unstake는 테뉴어 스케일 2→8 epoch cooldown; cooldown 중 0 weight·재stake/전송 불가.
- **Inv-BOUND-VEST** epoch 보상은 다음 4 epoch 선형 베스팅; 조기 unstake 시 미베스팅분 풀로 forfeit.
- **Inv-BOUND-EXCLUDE-EXITING** redeem-pending/slash-pending/appeal-pending/slashed SOUL = 0 weight.
- **Inv-BOUND-ISSUANCE** `Σ reward_i ≤ mint_n ≤ E_n` 매 epoch 온렛저(과발행 구조적 불가, Inv-MINT-ATOMIC 재사용).
- **Inv-BOUND-SINK-DEFINED** 가치원천(수익+stake-to-use 유틸) + sink(기능fee 100% burn + 수익 60% buyback-burn) 정의 — 순수 인플레 farm 아님.
- **Inv-BOUND-INSURANCE-SEGREGATED** BOUND 표시 보험버퍼는 BOUND로만; ICP collateral vault와 비대체·상호 backstop 금지.
- **Inv-BOUND-NO-HIDDEN-CLAIM** BOUND 거버넌스가 거버넌스를 부여해도 reserve-isolation 전체(INV-S1/S4/S7 **+ S8/S10 + 감사식**)는 코드/캐니스터에서 불가침; BOUND 거버넌스 범위 = BOUND 측 knob만(buyback%/burn%/티어/half-life) + cap down만.
- **Inv-BOUND-NO-VC** 사전판매/VC 배분 0, ICP 표시/백킹 배분 0 → 수수료 100% 환류.

**규제 (하드 게이트):** BOUND은 Howey형 분석에서 **증권성 표면이 있고, 경제적 reserve 격리가 이를 해소하지 않는다.**
출시 전 **토큰분류 법무검토 = HARD 빌드 게이트**(§4 SOUL 커스터디 게이트와 동급, feature flag로 못 켬). 마케팅은 *수익/패시브인컴*이
아니라 **유틸리티**(저렴한 fee/언락/Review-Toll 권한/크레딧)로 프레이밍; 위 BOUND/SOUL yield 표는 *발행 메커니즘*이지 광고수익률 아님.

**확정 다이얼 (JT, 2026-06-24):** half-life **10년** · throttle **게이팅 없음(k_n=0.4 고정)** · buyback **60/30/10 고정** · 에어드랍 **선형 tenure**.
프로필 = 스카시티 우선 · 시니어리티 가중 · 공격적 burn. 수용된 잔여 3: 무수익 ≤4.8M 경미 인플레(②) · 초기 opex는 treasury/team 충당(③) · 시니어리티 집중(④). (출시 전 재캘리 가능.)

## 4. §3.3 / 계약 함의 — 경제는 건전하나 **여전히 규제대상 커스터디 제품**

경제 건전성과 **별개로**, 이 채택은 §3.3("Activation SOUL=locked stake, no new issuance, not a reward, economics frozen")과
HARD RULE 5/6(Noop-only, main에 concrete-chain/ICP SDK 금지)을 깬다. `redeemable` = **사용자 ICP를 상환약속에 대해 커스터디** →
송금/전자화폐 커스터디·AML·법적 차원이 생긴다(전액준비라도 사라지지 않음). 따라서 빌드 전제:
**① §3.3 서명 unfreeze(JT/Cowork) · ② redeemable SOUL이 Activation SOUL과 다른 토큰 클래스인지 명문 결정 · ③ 법무/커스터디 검토.**
ICP-백킹 측은 Task 10식 **옵션 브랜치**, Noop/chain-neutral main 계약 아래 절대 두지 않음. feature flag로 켜는 것 금지.

## 5. 안전 경로 (Phase — 각 Phase에 §3 불변식 강제)
- **Phase 0** ICP 전환(canister/ICRC) vs Postgres-원장 결정.
- **Phase 1** 2-금고 Treasury/Reserve + redeemable 계산 + **INV-S1/S2/S3/S4/S10 + Mint-Atomic + Reconciliation**(발행보다 먼저).
- **Phase 2** redemption(S5/S6) + staking + burn/slash finality(S7/S8) + Slash-Not-Profitable + 권한 분리/Circuit-Breaker.
- **Phase 3** BOUND 원장(분리) + staking 보상 + **Inv-BOUND-*** + sink 정의(hype 토크노믹스).
- **Phase 4** audit/index/archive 하드닝 + 감사식 상시 모니터링.

## 6. 결론 (한 줄)
지급불능을 만드는 모델이 아니라, **슬래싱이 발생할수록 프로토콜 순자산이 증가하는 전액준비형 책임담보 시스템**이다.
경제 설계는 건전하다. 살리고 죽이는 것은 **§3의 불변식을 코드·DB 제약·권한 분리로 강제하느냐**, 그리고 **§4의 커스터디·법무
게이트를 통과하느냐**이다 — 둘 다 RC-1 동결 이후 + ICP 결정 + §3.3 서명 unfreeze와 함께 다룰 Northstar 사안.

---
### 부록 A. 초기 적대 검토에서 **철회/정정**된 주장 (이력 보존)
3-lens 적대 검토(2026-06-23)는 *USD-target 상환 크레딧 + 준비금 가용* 모델을 가정해 "UNSOUND AS-SPECIFIED"를 냈다.
JT의 전액준비·수량-peg·준비금 무손상 확정(2026-06-24)으로 아래는 **무효**:
- ~~"1 SOUL=1 ICP 구조 자체가 위험"~~ → 수량-peg + 전액준비라 무해. **삭제.**
- ~~"ICP 가격 하락 → 준비금 부족"~~ → 부채가 ICP 수량이라 자산·부채 동반이동, 불일치 0. **삭제.**
- ~~"BOUND 붕괴 → SOUL bank run"~~ → reserve 분리·전액준비면 최악이 질서있는 상환. **삭제.**
- ~~"wash-burn 파밍 / slash-to-mint"~~ → BOUND이 burn/slash가 아니라 **staking 보상** 재원이라 결합 자체가 없음. **삭제.**
**살아남아 §3으로 승격된 것**(모델 무관 진실): 무담보 발행 차단(Mint-Atomic/S2/S3) · 준비금 격리(S4/S10) · slash finality(S7/S8) ·
상환 이중사용 차단(S5/S6) · **권한 분리/단일 침해점**(최대 위험) · BOUND 분리·sink. 즉 리스크는 *경제 → 구현·커스터디·권한*으로 이동.
