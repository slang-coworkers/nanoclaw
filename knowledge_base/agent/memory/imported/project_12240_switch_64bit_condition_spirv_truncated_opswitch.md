---
name: project-12240-switch-64bit-condition-spirv-truncated-opswitch
description: "shader-slang/slang#12240 — 64-bit switch condition emits truncated OpSwitch (invalid SPIR-V); triaged+held pending skiminki authorization"
metadata: 
  node_type: memory
  type: project
  originSessionId: 365a67a9-06c1-4717-9ac6-fe5d2f88e7d1
---

# #12240 — 64-bit switch condition → truncated OpSwitch (invalid SPIR-V)

**Repo:** shader-slang/slang · **Filed:** 2026-07-27 by skiminki-nv (`Dev Opened`) · **Class:** bug / P2 / target-emit (SPIR-V)

**Symptom:** switch on a 64-bit integer selector (`uint64_t c; switch(c){ case 0x123456789ABCDEFU: ... }`) emits an OpSwitch whose case literals are a single 32-bit word regardless of selector width → SPIR-V validation fails: `End of input reached while decoding OpSwitch ... expected more operands after 5 words` (E99999). Upper 32 bits of the case value also dropped.

**Root cause (emit-side only):** `slang-emit-spirv.cpp:5436` — `kIROp_Switch` in `emitLocalInst` does `emitOperand((SpvWord)intLit->getValue())`, casting to one 32-bit word with no width query. IR is correctly typed (i64 case values); purely the SPIR-V emitter. REPRODUCED @HEAD `70462843c` (Debug slangc + `SLANG_RUN_SPIRV_VALIDATION=1`, no GPU). 32-bit-selector control compiles clean.

**Dedup:** DISTINCT root from siblings — do NOT merge, one fix does not cover multiple:
- [[project_12237_bool_switch_spirv_assert]] — bool / `processSwitch()` `IRBoolLit` normalization
- [[project_12238_float_switch_condition_invalid_spirv]] — float / `visitSwitchStmt` `TODO(tfoley)`
- #12236 & #9999 — missing-diag (`lowerSwitchCases()`)

**Fix (staged, Approach A, NOT applied):** mirror `emitIntConstant` from64/from32 via `getIntTypeInfo` at the OpSwitch literal site so case literals are emitted at the selector's bit-width; add spirv-validation regression test. Fixer briefing staged in triager memo.

**Status:** `reproduced` label applied; verdict posted https://github.com/shader-slang/slang/issues/12240#issuecomment-5095105992. Full triager briefing (root cause, repro, 2 candidate approaches + recommendation, dedup) staged for fixer as `triage-12240.md`.

**2026-07-28 — PR AUTHORIZED.** skiminki-nv commented "@nv-slang-bot: Please write a PR." (comment 5102267222). Self-defer released → routed to slang-triager → slang-fixer. Fix = Approach A.

**2026-07-28 — DRAFT PR #12251 OPEN (fixed, verified, held).** https://github.com/shader-slang/slang/pull/12251 — `nv-slang-bot`, branch `fix/issue-12240`, `Fixes #12240`, `pr: non-breaking`, `report_pr_created` confirmed. 2 files: `slang-emit-spirv.cpp` + `tests/spirv/switch-64bit-selector.slang`. Fix: OpSwitch case literals emitted at selector width — `getIntTypeInfo(...)` query → `SpvLiteralInteger::from64`/`from32` (2 words for >32-bit, else 1), mirroring `emitIntConstant`; 32-bit path bit-identical (existing switch tests unaffected). Tests: repro fails@HEAD/passes-with-fix; regression test (unsigned + negative-signed 64-bit + 32-bit control); full tests/spirv/ 546/546. codex PLAN/CODE/OUTPUT approve. Issue verdict (comment 5095105992) refreshed in place → "fix in draft PR #12251, held pending review". **CI `ci_failed` = benign manual-draft priority-yield** (builds skipped, `retry-yielded-bot-ci` reruns), NOT a real failure. **DRAFT-only; merge maintainer/OP-gated.** CLOSE-OUT trigger = #12251 merges (re-read merged diff → refresh verdict "fixed, merged"). RE-OPEN only on fresh substantive human comment.

**2026-07-28 12:45Z — APPROVED + flipped READY by maintainer.** skiminki-nv (maintainer + issue author) approved #12251 (review 4797341238, "LGTM", head `308c338801`), then marked it ready-for-review at 12:45:08Z **by their own hand** — drafts-only guardrail satisfied without us touching ready state (same pattern as #12115/szihs). Verified: `isDraft: false`, `reviewDecision: APPROVED`. Non-draft PR description now carries the public trail. **Holding on maintainer MERGE** — approval ≠ merge auth; neither fixer nor triager merges. No intermediate verdict refresh (merge is the trigger; comment 5095105992 already points at #12251).

**2026-07-28 17:56Z — ✅ MERGED. CHAIN CLOSED.** PR #12251 MERGED, merge commit `ae363b7545`, merged by skiminki-nv (maintainer + issue author). Issue #12240 CLOSED/COMPLETED, closedBy #12251. Merged diff (re-read): 2 files — `source/slang/slang-emit-spirv.cpp` (+11/−1: `getIntTypeInfo` selector-width query → `SpvLiteralInteger::from64` for >32-bit else `from32`; 32-bit path bit-identical; chose explicit 32/64 branch over general `ceil(width/32)` loop, justified in PR body) + `tests/spirv/switch-64bit-selector.slang` (+42: unsigned 64-bit, negative signed 64-bit, 32-bit control). Emit-layer fix; IR was already correct. tests/spirv 546/546. Issue verdict (comment 5095105992) refreshed → "Fixed, merged in PR #12251". Distinct root from siblings #12237/#12238/#12236/#9999 (all remain separate). RE-OPEN only on fresh substantive human comment.
