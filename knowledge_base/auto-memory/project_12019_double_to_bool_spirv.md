---
name: project_12019_double_to_bool_spirv
description: IN-FLIGHT —
metadata: 
  node_type: memory
  type: project
  originSessionId: 2dfb6dda-1c32-4c1b-83ca-858fb2c2819d
---

**#12019** (skiminki-nv, Dev Opened, CONTRIBUTOR/NVIDIA) — Invalid SPIR-V for `double`→`bool` cast under `-target spirv -emit-spirv-directly`. spirv-val/opt reject: `OpConstant ... says it has 4 words, but found 5`.

**Triage (slang-triager, 07-09):** REPRODUCED top-of-tree 468adc556 (compile-only, no GPU). `reproduced` label applied. bug / medium / P2 / target-emit (SPIR-V direct). Issue Type "Language Maturity" LEFT UNTOUCHED (human-set).

**Root cause:** `emitFloatToIntCast()` float→bool path at `source/slang/slang-emit-spirv.cpp:9294` calls `builder.getIntValue(fromType, 0)` where `fromType`==DOUBLE → mints an `IRIntLit` carrying a float64 type (malformed IR shape). `emitIntConstant()` (1177-1214) switches on type-op; `kIROp_DoubleType` hits `default:` → `from32` → ONE 32-bit literal word. A float64 `OpConstant` REQUIRES TWO literal words → structurally invalid. Only `double` breaks: for float/half the missing 2nd word is accidentally-correct since `uint32_t(0)` == IEEE +0.0f bit pattern (matches reporter's "value doesn't matter"). Reporter's "may be spirv-opt" hedge DISPROVEN — malformed word present in Slang's own raw pre-opt output.

**Fix (Approach A, RECOMMENDED):** at :9294 (and the vector splat below) use `builder.getFloatValue(fromType, 0.0)` instead of `getIntValue` — mirrors the correct int→float sibling at :9258 (`getFloatValue` → `kIROp_FloatLit` → `emitFloatConstant` → `from64` → 2 words). Also principled-fixes float/half. Approach B optional add-on: `SLANG_ASSERT(!isFloatingType(type))` in `getIntValue` (slang-ir.cpp:2415) — pair with A, not a substitute. Approach C REJECTED (consumer-side patch of malformed shape at wrong layer).

**Test:** spirv target compile of repro with SPIRV validation ON + float/half variants (CPU/interpreter can't exercise `-emit-spirv-directly` word layout).

**State (07-09 11:22Z — LANDING under maintainer, Main-verified live):** PR **#12021** (https://github.com/shader-slang/slang/pull/12021), `Fixes #12019`, `pr: non-breaking`, head `311834d523`. Diff = exactly Approach A (one behavioral line: `getIntValue(fromType,0)`→`getFloatValue(fromType,0.0)` in `emitFloatToIntCast` float→bool branch; mirrors int→float sibling :9258). Approach B (getIntValue assert) deferred (matches recommendation). Tests: `tests/bugs/12019-double-to-bool-cast.slang` (double/float/half, buffer-fed anti-constfold, `-emit-spirv-directly`+validation, rc=0 + `OpFUnordNotEqual`) 3/3 PASS; sweep 631/631; codex APPROVED.

**Review (Main-verified 11:22Z, NOT relay):** skiminki-nv **APPROVED** ("LGTM", review 4662469319, 11:12:57Z), PR now **non-draft** (`draft:false`, updated 11:14Z), skiminki-nv **self-assigned** (was jkwak-work). Non-draft is NOT a drafts-only breach — MAINTAINER skiminki-nv flipped it (human self-assign + APPROVE in same 11:12–11:14 window; bot's only review action was the 10:36 COMMENTED revert of the earlier comment-text nit). `report_pr_created` CONFIRMED working (skiminki @nv-slang-bot review-mention 10:26 auto-routed to fixer, answered 10:36, never hit Main as pr_mention → PR→session map exists). mergeStateStatus BEHIND (base update; merge queue handles at merge — bot does NOT rebase approved maintainer-owned branch). Auto pull_request CI green so far (0 real failures, wait-for-human-priority=SUCCESS).

**MERGED (Main-verified 07-09 14:25:20Z; merge commit a47c1b885f):** skiminki-nv merged #12021 into master (all gated actions maintainer's). `Fixes #12019` auto-closed the issue. Chain TERMINAL. Worktree `wt-slang-12019` reaped + active-work sentinel cleared by fixer post-merge (confirmed in fixer [Fix Report — MERGED]). Canonical thread `gh-issue-shader-slang/slang-12019`.
