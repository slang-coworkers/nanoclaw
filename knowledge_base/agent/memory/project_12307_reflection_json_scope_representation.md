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

**CI triage:** check-suite 83205848750 = benign priority-yield (only `wait-for-human-priority`+`check-ci` "failed"; ALL builds/tests SKIPPED — nothing real ran). No code action. ⚠️**STRUCK 08-07: the "`retry-yielded-bot-ci` reruns it" clause was FALSE** — see the CI-NEVER-BUILT block below. I recorded and relayed that clause twice; it is not a timer.

**⚠️ CORRECTION to earlier fixer report:** FileCheck **IS** available locally via in-tree `slang-llvm` (`LD_LIBRARY_PATH=build/Debug/lib slang-test tests/reflection/scope/`). All **8 scope tests pass under real LLVM FileCheck; full `tests/reflection/` = 50/50**. Earlier "Ignored/verified via grep" was only a loader-path issue, NOT a skipped-test gap. (Learnings saved: FileCheck-via-slang-llvm; prettier-version-skew trap.)

**Gate:** codex CODE_REVIEW ✅ (round 11, after 2 must-fix cycles), OUTPUT_REVIEW ✅, PLAN_REVIEW ✅; clang-format clean; `pr: non-breaking` present.

**MAINTAINER REVIEW (2026-08-01): CHANGES_REQUESTED** by @tangent-vector — [pullrequestreview-4885453186](https://github.com/shader-slang/slang/pull/12310#pullrequestreview-4885453186) (empty body; substance in 2 inline comments). Both land on **exactly the reviewer's C002 area**, and both ask for the **assert** option — the side the fixer did NOT take in the polish round (it reworded the contract + renamed the param, keeping the early-out).

1. [r3737843847](https://github.com/shader-slang/slang/pull/12310#discussion_r3737843847) on the non-`Struct` early-out: *"Should this be an `assert` rather than a CYA early-out? It seems like there is an invariant being assumed here, rather than a situation being tested."*
2. [r3737850035](https://github.com/shader-slang/slang/pull/12310#discussion_r3737850035) on the switch structure: *"Why not make this be a case just for `struct`s, and then have a catch-all `default` that asserts, so that we know we are handling all the cases that can actually arise? Treating this like a `default` and then throwing away everything but `struct`s in the callee is slippery."*

⚠️ **CRUX — unresolved factual tension on reachability.** The assert-vs-handle call turns entirely on whether a non-`Struct` scope layout is reachable, and the two parties disagree:
- **Fixer's polish report claimed** "non-Struct reachable via either call site" — which is *why* it kept the early-out.
- **Reviewer A's producer trace** (`ScopeLayoutBuilder::endLayout`, `slang-parameter-binding.cpp:~3107-3140`) found a scope's element is **always** a raw `StructTypeLayout`, i.e. NOT reachable.
- **Maintainer** treats it as an invariant (⇒ unreachable).
Blindly asserting a genuinely-reachable case would introduce a crash. Fixer must settle reachability from source FIRST: if unreachable → restructure per maintainer (explicit `Struct` case + asserting `default:`); if genuinely reachable → do NOT assert, reply on GitHub with the concrete triggering input.

**ROUND 2 DONE (2026-08-07) — shipped `e2befa07ef`, still DRAFT/held. CRUX SETTLED: non-`Struct` is UNREACHABLE; the fixer's earlier "reachable" claim was WRONG and it retracted on-thread rather than defending.** Reviewer A + @tangent-vector were both right.

Re-derived trace (source): `ScopeLayoutBuilder::endLayout` sets scope layout to `m_structLayout` (always `StructTypeLayout`) → `createConstantBufferTypeLayoutIfNeeded` either returns it unchanged OR calls `_createParameterGroupTypeLayout(ctx, nullptr, elementTypeLayout)` which sets `elementVarLayout->typeLayout = rawElementTypeLayout` — the wrapper's element IS that same struct. Entry-point path (`SimpleScopeLayoutBuilder::endLayout`) delegates to `Super::endLayout()` — identical. codex found a 3rd path (deserialized entry-point scopes) — same result. `spReflectionTypeLayout_getKind` maps a null-`type` `ParameterGroupTypeLayout` to `CONSTANT_BUFFER`, **never** `PARAMETER_BLOCK`. ⇒ a scope is exactly {`Struct`} or {`ConstantBuffer` wrapping that struct}. Asserts are therefore correct, not a crash.

Change (net **−21 lines** — following the maintainer's ask through allowed deleting more than was added):
- explicit `case Struct` (`kind:"none"`), explicit `case ConstantBuffer`, `default:` asserts; callee early-out → assert.
- **DELETED** the `"parameterBlock"` scope kind + the nested-`"scope"` recursion (now proven unreachable; CLAUDE.md: remove what a refactor makes unreachable). Docs describe only the two real shapes. **Proof they were dead: ZERO `.expected` baselines changed — output byte-identical.**
- Verified with the assert LIVE (debug build) under real FileCheck: scope 8/8, `tests/reflection/` 52/52, the 9 PR-regenerated baselines outside that dir 10/10. No assert fired — including on the ParameterBlock and nested tests.
- Replies posted to both inline threads ([r3738033990](https://github.com/shader-slang/slang/pull/12310#discussion_r3738033990), [r3738036074](https://github.com/shader-slang/slang/pull/12310#discussion_r3738036074)); threads left unresolved (maintainer's to resolve).
- Cleared BEHIND → `behind: 0`; master's 9 new commits had zero overlap with the PR's files and nothing touched reflection/layout/harness, so the verification still binds.

**Fixer's own measurement corrections (worth keeping):** (1) "130/130" came from one combined `slang-test` run that swept in unrelated tests — unreproducible, replaced with the exact 9-file 10/10. (2) The earlier "56 overlapping files" reading was a two-dot-diff artifact showing its own additions as master-side changes. Rule it drew: *a figure you can't re-derive on demand is worse than no figure.*

**CI-failed webhook 2026-08-07 on 3rd SHA `79297fa854` (check-suite 84689549891)** — post-rebase/merge push (the `behind:0` clear onto master's 9 commits), NOT `e2befa07ef`. Triaged by fixer at JOB level: **benign priority-yield** — red = exactly `wait-for-human-priority` + `check-ci`; **skipped = all 9 build + all 20 test jobs** (linux/macos/windows × debug/release × x86_64/aarch64/wasm + rhi/falcor/materialx/sm80/sanitizer/compile-regression); only `filter` ran (success); `run_attempt: 1`. My rebase concern didn't materialize — but **not because lanes passed: nothing ran at all**, so neither the PR's code nor master's 9 commits was exercised.

⛔**CI HAS NEVER COMPILED THIS HEAD — "CI green on `79297fa854`" is UNESTABLISHED, not pending.** Fixer checked all 11 runs at this SHA for non-skipped `build-*` jobs: **zero across the board.** `pull_request` CI is skipped (draft); `workflow_dispatch` yielded. ⇒ the **only** real signal on the merged state is the fixer's local debug build + suite (scope 8/8, `tests/reflection/` 52/52, 9 PR-regenerated baselines 10/10, asserts live, none fired, zero baseline changes) — good evidence, but a different artifact from CI, and it cannot cover lanes not runnable locally (macos/windows/aarch64/wasm/sanitizer).

⛔**STANDING-EXPECTATION CORRECTION (I had this wrong twice):** `retry-yielded-bot-ci` is **contention-gated, not a timer** — it requires a *rerun* (which mutates the same run id, so **`run_attempt` is the instrument, not the presence of a newer run**) and its first gate refuses while any `ci.yml` run is active. **A yielded run can expire un-rerun.** ⇒ do NOT tell anyone a yielded bot-CI run "clears itself." The reliable path to a genuine build of this head is the **ready-flip**, which fires a fresh `pull_request` run bypassing the priority gate — and that is **operator-gated**. Consequence: the maintainer may re-review a head that CI has never built.

**SHA MAP (fixer correction — my earlier resume pointer named a stale SHA):**
- `e2befa07ef` — the assert-the-invariant restructure (the *reviewable code change*).
- **`79297fa854` — TERMINAL PR HEAD.** Master merge clearing `behind: 0`; touches none of the PR's files. Fixer re-ran everything on the merged state (scope 8/8, `tests/reflection/` 52/52, 9 PR-regenerated baselines 10/10, zero `.expected` changed, no assert fired) before pushing, then dispatched draft CI.

**RESUME after this:** @tangent-vector re-reviews **`79297fa854`** (the actual head — same code as `e2befa07ef` plus the merge; his call, he resolves the 2 inline threads) → mark ready/merge (OP-gated). Max-2-round path is CLOSED — a 3rd round needs fresh authorization; CI-break triage on an owned PR is ownership maintenance and does not count as a round. Or fresh substantive human comment.
