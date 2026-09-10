---
name: project_11323_casttovoid_closed_wronglayer
description: "#11323 drop-CastToVoid-before-emit CLOSED-UNMERGED — wrong layer; fix belongs at producer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 538faad0-f117-4615-8b96-c7f5d28504a8
---

PR #11323 (`Fix #11315: drop kIROp_CastToVoid before emit`, branch `dev/slang-fixer/fix-11315-cast-to-void`) was **CLOSED-UNMERGED** by maintainer skiminki-nv 2026-07-15 09:48Z. Approach rejected as **wrong-layer**, not unsafe.

- The `(void)x;` ICE (issue **#11315**, still OPEN) was fixed by an `eliminateCastToVoid` pre-emit drop pass. skiminki-nv: **never produce `kIROp_CastToVoid` in the first place** — it does nothing at the IR level, and `[NoDiscard]` is already enforced in the front-end (`slang-check-stmt.cpp`). Root-cause fix belongs at the **producer**, not a pre-emit drop.
- slang-pr-approver decision (shadow, ledger): **ABSTAIN_POLICY (CHALLENGER_CONCERN)** @ `ed53107b56`. Devin-only tier flagged unconditional `removeAndDeallocate` w/o use-check; challenger refuted (op provably use-free) → not BLOCK, but sole-reviewer flag on core IR mutation → not auto-approve. `human_verdict=CHANGES_REQUESTED` recorded. Hold direction vindicated (agreement, not false-safe).
- **Calibration miss:** challenger proved the drop memory-*safe* but never asked the producer-fix question. Rule: *drop-a-no-op-before-emit — safe ≠ right; produced-once/consumed-nowhere/dropped-before-emit ⇒ fix the producer.* Wrong-layer rejection is REQUEST_CHANGES-shaped even when provably safe.

**RESOLVED via #12117 (2026-07-15).** skiminki-nv filed their own correct-layer redo: **PR #12117** "Fix #11315: lower `(void)expr` to the canonical void value." Both producer sites now emit canonical `getVoidValue()`/`IRVoidLit` instead of materializing `kIROp_CastToVoid`; the op enum survives only as the `__init(void)` intrinsic identity (`opMap[5][6]→[5][5]` shrink, index-safe). Front-end `[NoDiscard]`/E30059 untouched; side effects preserved (nodiscard test buffer check). slang-pr-approver shadow verdict: **WOULD_APPROVE (CLEAN)** @47deb4ef — PRIMARY tier (production claude-code-action review, 0🔴/3🟡, all 🟡 = coverage/defensiveness advisories), 6/6 clauses, challenger CLEAN. `check-formatting` CI red = cosmetic opMap line-wrap, author-fixable/codegen-inert (`require_ci_green=false`). **Approver shadow verdict WOULD_APPROVE (CLEAN) — TWO rows: R1 @47deb4efaf55, R2 @5918fba3 (current head). PR OPEN as of 2026-07-15 11:42Z, awaiting real merge.**

- **R1 @47deb4ef:** WOULD_APPROVE (CLEAN), production review 0🔴/3🟡. Row stands.
- **Spurious signals (2026-07-15 ~11:18Z):** a `pr_synchronize`→"@b8f1c2a0" + `pr_closed merged:true` arrived but **DID NOT reconcile** — `b8f1c2a0` never existed (gh 422), head hadn't moved. Approver correctly HELD, NO human verdict stamped. I mis-propagated "MERGED" to memory then reverted. Filed shared learning: *pr_closed/pr_synchronize webhooks are claims — verify vs live GitHub before propagating a terminal state or a ledger stamp.*
- **R2 @5918fba312ea9b7abe26bb0b29f15b08375a5796 (VERIFIED real, 2026-07-15 11:42Z):** head genuinely advanced 47deb4ef→5918fba3 (I pre-verified via `gh` before routing). 2-commit responsive iteration ("Format fix" + "Address bot review feedback") addressing all 3 R1 🟡 gaps WITHOUT touching producer-fix core: opMap `From Bool` row collapse (`check-formatting` now GREEN), `fromStyle/toStyle<5` bounds asserts (Gap 3), `SLANG_ASSERT→SLANG_RELEASE_ASSERT` on argCount==1 (Gap 2), `-cpu COMPARE_COMPUTE` directive (Gap 1). All 6 producer-fix invariants re-verified @5918fba3. Fresh production review 🟡 2 gaps/0 bugs, Devin exit0 clean. **WOULD_APPROVE (CLEAN)**, fresh ledger row for 5918fba3, 6/6 clauses. `check-formatting` GREEN, no blocker.
- **TERMINAL — #12117 MERGED 2026-07-16T09:36:45Z** by skiminki-nv (merge commit `8e8653f8`), PR head `5918fba3` = R2 decision head byte-identical, zero follow-up commits. Human collaborator **jvepsalainen-nv explicitly APPROVED @07:31Z** before merge. Approver verified the join vs live GitHub (state=MERGED, mergeCommit resolves, head=decision SHA — unlike the refused spurious b8f1c2a0) and stamped: **R2 @5918fba3 = APPROVED (clean agreement, vindicated approve)**; R1 @47deb4ef = SUPERSEDED_BY_LATER_REVISION. → **#11315 CLOSED. Chain terminal.**
- **Arc closed & vindicated:** #11323 wrong-layer drop (shadow ABSTAIN→CHANGES_REQUESTED, vindicated hold) → #12117 correct-layer producer fix (shadow WOULD_APPROVE→merged+human-approved, vindicated approve), both by the maintainer who defined the layer. Calibration: two-for-two agreement across the arc.

Related: [[feedback_verify_pushed_state_by_branch_not_sha]], [[feedback_never_fabricate_events_between_turns]].

**Calibration arc closed:** wrong-layer #11323 (drop-before-emit, safe≠right) → correct-layer #12117 (fix the producer), authored by the same maintainer who defined the layer. Confirmed the logged rule: *a no-op produced-once/consumed-nowhere ⇒ fix the producer.* Related: [[feedback_dont_close_open_proposals]].
