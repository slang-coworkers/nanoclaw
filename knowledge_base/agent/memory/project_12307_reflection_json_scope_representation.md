---
type: project
title: "#12307 JSON reflection global/entry-point scope representation"
description: "Design proposal to add globalScope/scope objects to -reflection-json; PARKED awaiting @tangent-vector design call"
tags: [slang, reflection, json, design-proposal, parked]
---

# shader-slang/slang#12307 — JSON reflection scope completeness

**Filed:** 2026-07-31 by nv-slang-bot[bot] (our own coworker) **at the request of maintainer @tangent-vector**, surfaced during review of PR #11135 (byte-range "used" tracking). Explicitly scoped to format+traversal, independent of #11135.

**What:** `slangc -reflection-json` drops the implicit `$Globals` constant-buffer / parameter-block that wraps a scope — the wrapper's own binding is invisible and the descriptor slot it consumes shows as an unexplained hole (gTex/gSamp at index 1,2; slot 0 silently eaten). Same gap for entry-point scopes. Proposal: add additive top-level `globalScope` object + per-entry-point `scope` object via one shared `emitReflectionScopeJSON` routine mirroring `printScope` in `examples/reflection-api/main.cpp`; keep flat `parameters[]` verbatim for back-compat.

**Triage (slang-triager, @HEAD 744eb9ed4):** enhancement / medium / **P2** / component: reflection (JSON). Gap REAL; all 7 technical claims VERIFIED. Flat `getParameterByIndex()` loops at `slang-reflection-json.cpp:1304` + `:1188` never call scope-aware `getGlobalParamsVarLayout()`/`getVarLayout()`; container+element machinery at `:774` exists but only fires for CB/PB-typed *params*, never a scope's implicit wrapper. Strictly additive. NOT a dup (distinct from #12183 cumulative-offset; #11135 is out-of-scope origin).

**Verdict posted:** https://github.com/shader-slang/slang/issues/12307#issuecomment-5147930774 (fresh, 0 prior comments). Memo: `/workspace/inbox/a2a-1785536285237-50cro8/triage-12307.md`.

**STATE: FIX-AUTHORIZED (2026-07-31)** — was PARKED; @tangent-vector answered both design questions + blessed the plan in [issuecomment-5148271886](https://github.com/shader-slang/slang/issues/12307#issuecomment-5148271886). Released slang-fixer for a **DRAFT** PR.

Maintainer's decisions (implement exactly):
1. **Shape:** use the explicit hand-crafted `globalScope`/`scope` shape (NOT reuse `emitReflectionVarLayoutJSON` on the scope's VariableLayoutReflection). Rationale: scopes are "pseudo variable layouts," so the hand-shaped representation is more semantically correct.
2. **Version field:** add top-level `"version"`. Semantic versioning. Output *without* the field → treat as implicitly `"1.0"`. Tag this new additive schema as **`"1.1"`** (back-compat for existing consumers; consumers wanting the new schema reject earlier versions).
3. **Plan:** "good as presented in the issue description" — implement per the issue's 6-step plan (shared `emitReflectionScopeJSON` routine mirroring `printScope`; call twice via `getGlobalParamsVarLayout()` + per-entry `getVarLayout()`; keep flat loops untouched; tests under `tests/reflection/`; docs update `docs/user-guide/09-reflection.md`).

**Guardrail:** DRAFT-only PR, HELD pending review/approval (drafts-only). Since draft doesn't auto-close the issue, fixer MUST also post the 5-bullet on the issue (verdict = "design approved → fix in draft PR #N, held pending review"). Canonical thread: `gh-issue-shader-slang/slang-12307`.

**DRAFT PR #12310** opened 2026-08-01 (branch `fix/issue-12307`, base master): https://github.com/shader-slang/slang/pull/12310. Impl: `emitReflectionScopeJSON` (mirrors `printScope`), called twice (globalScope + per-entry scope), flat loops untouched, top-level `"version":"1.1"`. 109 additive emitter lines (0 removed/modified). 7 new FileCheck tests `tests/reflection/scope/`; all 46 regenerated baselines insertion-only (additivity proof gate held). Docs section added to `09-reflection.md`. In peer review via slang-reviewer (relayed through Main; max-2-round path).

Observability wired: 5-bullet posted on issue #12307 ([issuecomment-5148828200](https://github.com/shader-slang/slang/issues/12307#issuecomment-5148828200), verdict "design approved → draft PR #12310, held pending review"). PR #12310 mapped from fixer's own session (report_pr_created) — webhooks route there. codex gate: CODE/PLAN/OUTPUT_REVIEW all ✅. CI "failure" on #12310 = benign priority-yield (`wait-for-human-priority`+`check-ci`, all builds/tests skipped; auto-rerun by `retry-yielded-bot-ci`) — NOT a real failure, no code action.

**REVIEW VERDICT (2026-08-01): APPROVE_WITH_NITS** — 0 bugs, 3 gaps (all non-blocking), +clarity advisories. Devin (Reviewer B) clean 0/0/0. 3 reviewers complete, drift=0. Reviewed commit `190f5c9392` (draft), diff sha256 `0ea0586925aa`. Combined report: `/workspace/inbox/a2a-1785549687780-e3sntu/combined-review.md` (sent to fixer).

Actionable findings routed to fixer for a polish round (DRAFT kept):
- **Gap #3 (docs, cheap):** `09-reflection.md:~1715` presents container `binding.kind` as fixed SPIR-V `descriptorTableSlot`; it's target-dependent (HLSL `constantBuffer`, Vulkan/SPIR-V `descriptorTableSlot`, CPU/CUDA `uniform` offset). Add one sentence.
- **C002 (clarity, strongest):** `emitReflectionScopeParametersJSON` silently returns on non-`Struct` (omits `"parameters"` key entirely, vs `[]` for zero-field struct) → empty-scope output-shape inconsistency; param named `structTypeLayout` contradicts guard. Fix: assert-or-rename + make empty-scope shape deterministic+documented + test (entry point w/ only varying params).
- **Gap #1 (hygiene):** nested-`"scope"` recursion branch + `"parameterBlock"` kind string unreachable via current front-end & untested. Lean DOCUMENT-as-intentional (matches maintainer's printScope-mirror intent) + reachability comment + optional slang-unit-test pinning nested JSON; OR assert+drop (passes revert drill). **Also confirm CI runs the 7 new tests in FileCheck mode** — showed `Ignored` locally (FileCheck absent).
- **Gap #2 (.32 baseline):** already documented in PR body; already stale pre-PR (missing sizes/alignment). Leave-as-documented OR regenerate — fixer's call, low priority.
- FG004 tighten nested-test CHECK lines (CHECK-NEXT/SAME); FG006 key-order asymmetry — optional.

**POLISH ROUND DONE (2026-08-01), pushed `190f5c9392`→`15296db6d0`** (still DRAFT/held):
- C002/FG001: reworded `emitReflectionScopeParametersJSON` contract + renamed `structTypeLayout`→`elementTypeLayout` (name/guard agree; non-Struct reachable via either call site).
- Gap#1/C001: recorded reachability invariant on `emitReflectionScopeJSON`.
- FG004: `global-scope-nested.slang` tightened with `CHECK-NEXT` to pin nesting on the param's own type.
- New test `entry-point-scope-empty.slang`: pins empty-scope shape (`kind:"none"` + `"parameters": []` via `CHECK-EMPTY`).
- Gap#3/FG005: docs note binding kind is target-dependent + nested-scope shape is contract-but-not-emitted-today.
- Left `.32` as-documented (Gap#2 optional); skipped FG006 key-order nit (would re-churn baselines, zero functional gain).

**CI triage:** check-suite 83205848750 = benign priority-yield (only `wait-for-human-priority`+`check-ci` "failed"; ALL builds/tests SKIPPED — nothing real ran). `retry-yielded-bot-ci` reruns. No code action.

**⚠️ CORRECTION to earlier fixer report:** FileCheck **IS** available locally via in-tree `slang-llvm` (`LD_LIBRARY_PATH=build/Debug/lib slang-test tests/reflection/scope/`). All **8 scope tests pass under real LLVM FileCheck; full `tests/reflection/` = 50/50**. Earlier "Ignored/verified via grep" was only a loader-path issue, NOT a skipped-test gap. (Learnings saved: FileCheck-via-slang-llvm; prettier-version-skew trap.)

**Gate:** codex CODE_REVIEW ✅ (round 11, after 2 must-fix cycles), OUTPUT_REVIEW ✅, PLAN_REVIEW ✅; clang-format clean; `pr: non-breaking` present.

**RESUME after this:** @tangent-vector's implementation review of DRAFT #12310 → mark ready/merge (OP-gated, drafts-only until maintainer). Or fresh substantive human comment.
