---
type: issue
title: "slang#14493 — SPIR-V: #11011 legalizeDefUse hoist makes loop vars loop-carried (~6% Vulkan path tracer)"
description: TERMINAL — PR #14502 merged 11-18 (db7603bf3d, kaizhangNV); issue left open for maintainers to close
---

# slang#14493 — legalizeDefUse hoist / loop-carried OpPhi

- **Filed:** 11-16 ~06:50Z, human **minco3** (returning external reporter, cf. #14069), no labels/assignees.
- **Issue:** After PR #11011 (commit 297ce6035), `legalizeDefUse` hoists a variable to a loop header with no
  per-iteration init store → previous-iteration value flows around the back edge → extra loop-header `OpPhi`s
  after `spirv-opt -O` (7→8 in the repro) and values stay live across `OpTraceRayKHR`. Bisected ~6% GPU-time
  regression in a production Vulkan path tracer on v2026.21; revert restores timing. Repro + OpPhi table in the
  issue body. Reporter suggests an undef store or restoring default-init for non-textual targets.
- **Triage (slang-triager, formal report 11-16 08:07Z, msg id 32):** regression (perf/QoI) / medium / **P1** / IR
  (`legalizeDefUse`); not a dup. **Repro CONFIRMED at ToT `cdca151fb` both directions** (HEAD = 8 OpPhi, extra
  `%213` matching the issue verbatim; 297ce6035 reverted in a temp working-tree patch + rebuild = 7 OpPhi,
  restored after). Mechanism: no def on the preheader path → SSA `readVar` recurses around the back edge
  (slang-ir-ssa.cpp:1121) and mints a loop-header phi. Correctness unaffected (valid SPIR-V, value
  UB-by-contract). Recommended A: per-iteration `emitLoadFromUninitializedMemory` store at the hoist site
  (slang-ir-util.cpp:3273-3279; impl slang-ir.cpp:3310). B (restore emitDefaultConstruct for non-textual
  targets) re-adds dead zero stores; C (emit zero in emitter) wrong layer. Triager sent a [Triage handoff]
  memo to the fixer directly.
- **Fix (slang-fixer, 12:25Z progress — shape evolved beyond approach A):** an undef-only store is NOT
  sufficient — Slang's embedded spirv-opt (-O1 preset) aggressive-DCE removes OpUndef stores from the
  final module (measured: still 8 OpPhi). Landed fix has 3 parts: (1) legalizeDefUse stores per-iteration
  `LoadFromUninitializedMemory` init at both hoist paths (kills the loop-carried phi in Slang's own IR);
  (2) eliminate-phis in register-allocation mode materializes IRUndefined phi incomings as raw
  `DefaultConstruct` instead of skipping the store (expandable struct/array types EXCLUDED — keeps
  #11011's no-zero-composite contract); (3) SPIR-V emitter maps `DefaultConstruct` → `OpConstantNull`.
  Reporter's exact flow verified: 8→7 loop-header OpPhi, merge phi takes `%float_0` on the exhausted path,
  nothing new live across OpTraceRayKHR (matches pre-#11011).
- **Draft PR #14502** — "Break loop-carried dependency of values hoisted to loop headers (#14493)", branch
  fix/issue-14493, label pr: non-breaking; issue status comment 6918848922, PR explanation comment
  6918781838 (refreshed per head). Initial head `15c8e6465`; critique-gate hook infra note went to the
  dashboard (msg id 51): the PostToolUse hook lost MCP tool_input.prompt after the 12:05Z restart.
- **[Fix Report] 16:52Z — chain fix-complete, awaiting human review.** Final head `7e745957e` (vs master
  cdca151fb; verified live: open, draft, mergeable_state blocked = normal for a draft). R2 verdict
  APPROVE_WITH_NITS (0 bugs/6 gaps — all applied in 7e745957e); Devin 0/0/1; codex OUTPUT_REVIEW passed.
  Final shape: legalizeDefUse per-entry LoadFromUninitializedMemory init at both hoist paths + phi
  elimination materializes undefined incomings as `emitDefaultConstruct(type, false)` in
  register-allocation mode (aggregates/opaque/UserPointer keep status-quo skip; slang-emit-spirv.cpp nets
  zero — the R1 emit case was folded producer-side). 6 files +295/−15. Tests: repro feaeb8c14 fails at
  base; head passes affected 26/26 (incl. float4/float2x2 SPIR-V+HLSL variants), tests/bugs 1053/1053,
  autodiff 1030/1030, autodiff-dstdlib 63/63; reporter flow 7 OpPhi / %float_0 exhausted path;
  spirv-val clean; revert drill documented (stores load-bearing for memory-resident vars +
  minimal-optimization builds). Fixer worktree `wt-slang-14493` parked until merge/close. Awaiting
  kaizhangNV human review (jhelferty-nv routed the issue to him; rung 4 → no issue-side bot posts);
  ready-flip on the weekly list. Fix-report signal relayed to the triager for its [Triage Resolution].
- **R1 history (REQUEST_CHANGES 0 bugs/4 gaps, applied in a92d32f44):** the part-3 SPIR-V `OpConstantNull`
  emit case was DEAD CODE (peephole folds raw DefaultConstructs before emitters; emitted `%float_0` is
  OpConstant) and risked silent invalid SPIR-V for opaque shapes → replaced with producer-side
  `emitDefaultConstruct(type, false)` fold, emit case reverted; UserPointer excluded
  (PhysicalStorageBuffer OpConstantNull fails spirv-val); both hoist-init branches pinned by positive IR
  checks; HLSL variant added to gh-14493.slang. Load-bearing subtlety caught locally: an over-broad gate
  re-expanded aggregate zeros and failed the no-zero-init tests pre-commit — the aggregate exclusion
  matters.
- Triage investigation detail (removed-store history, pass order, peephole hazard) from triager msg id 14:
  - Existing tests `tests/bugs/legalize-defuse-no-zero-init{,-non-var,-non-var-primitive}.slang` encode
    #11011's behavior — a plain revert breaks them; init must not be an expandable zero.
  - `removeRawDefaultConstructors` runs EARLIER (slang-emit.cpp:2631-2643) than legalizeDefUse's caller
    (eliminateMultiLevelBreak at :2817) — a re-added raw `kIROp_DefaultConstruct` would never be stripped
    and SPIR-V emit has no case for it.
  - simplifyIR peephole (slang-ir-peephole.cpp:2123-2147, runs right after at :2820) ELIDES stores of
    Poison/plain Undefined but **preserves `emitLoadFromUninitializedMemory` stores** (SPIR-V: OpUndef,
    slang-emit-spirv.cpp:5626). Poison-store fix would be erased.
  - Test gap: the 3 no-zero-init tests are single-iteration, cannot catch loop-carried values.
  - **Triager's GitHub posts landed 09:09Z after the 11-16 auth outage RESTORED** (verified live: labels
    `regression`+`reproduced` on the issue, authenticated API 200): 5-bullet comment 6912562207, Issue Type
    Bug via GraphQL; retry one-shot `i14493-gh-retry-069e` canceled. Fixer never parked (build green ~09:28Z
    after resolving submodule fetches anonymously; repro confirmed at `cdca151fb`; fix A in progress on both
    hoist paths).
- **Fixer:** dispatched 11-16 08:01Z on canonical thread `gh-issue-shader-slang/slang-14493` with the
  triager report verbatim; triager also sent a direct [Triage handoff] (msg 13) into the same session — one
  owner session `sess-1794816064589-gbzwl1`, verified, no phantom. Auth restored 09:09Z before push time, so
  no park is expected.
- **Severity context:** bisected perf regression on the release track (v2026.21); fixer chain not held.
- Related: PR #11011 (the cause), #11010 (the original zero-materialization cost the PR removed).
- **11-17 08:01Z — kaizhangNV took over PR #14502: redesign on our branch + ready flip.** He pushed
  67143ec9a ("Preserve scalar and vector SSA in direct SPIR-V emission") directly onto fix/issue-14493 —
  scalar/vector block params no longer demoted to registers (PhiEliminationOptions::preserveScalarAndVectorPhis
  for direct SPIR-V); they stay SSA and the emitter emits real OpPhi, so the def-less-register information
  loss never happens; aggregates/pointers keep temp-var lowering. He rewrote the PR description, added
  tests/spirv/preserve-phi-types.slang; his design covers BOTH pipelines (phi elimination is emit-pipeline,
  not an optimization). The fixer's mechanism commits remain as history/scaffolding; his direction is the
  acceptance criteria. Fixer fixed the one CI failure at his head (geometry-shader-global-array-12169:
  SSA-preserved induction value disassembles under its name hint %ii, patterns missed — widened in forward
  commit `1e98dd80d`, invariant unchanged, 4/4) and rewrote the explanation comment for his mechanism.
  Verified live 08:0xZ: **head 1e98dd80d6, draft=False (ready-flipped, not by our bot), mergeable_state
  behind** → off the weekly ready-flip list. Reporter flow: 7 OpPhi both pipelines. **Operator ask (id 97)
  closed as mooted by events** (dashboard msg 103); held clarification stays held. Fixer's record-note: some
  of its earlier test assertions may pin looser artifacts under the redesign — passing/CI-green, left as-is
  since kaizhangNV owns the mechanism and test shape. **Pending: kaizhangNV's merge (master merge first —
  merge, never rebase, per maintainer direction) + reporter's production retest.**
- **11-17 18:19Z — jkwak-work APPROVED PR #14502** (review 5944160849, "Looks good to me", verified live) —
  the "driver side bug" commenter approving the compiler fix definitively retires that wrinkle. PR
  mergeable (BEHIND — master moved since cdca151fb; maintainers merge on their cadence; if they ask for an
  update: merge master, never rebase). **Awaiting merge webhook → terminal: worktree `wt-slang-14493`
- **11-18 08:03Z — TERMINAL: PR #14502 MERGED** (merge commit `db7603bf3d`, merged by kaizhangNV, verified
  live; final head 3f1403f5c). Fixer cleaned worktree `wt-slang-14493` + sentinel; triager signaled to close
  its record/register and drop the held clarification (id 111); dashboard terminal report sent (id 113).
  **Issue #14493 verified still OPEN at 08:0xZ** — the `Fixes #14493` auto-close hadn't landed; closing is
  the maintainers' action alone. **Issue CLOSED 11-18 18:48:33Z (state_reason: completed)** — kaizhangNV
  posted the close-out pointer (cmt 6988239427, "This is fixed by PR #14502") and the issue is resolved.
  Chain fully terminal; this record needs no further updates. Chain timeline: filed 11-16 06:50Z (minco3) → triaged P1 (repro both
  directions) → fix (undef-store insufficiency → 3-part mechanism → reporter's minimal-pipeline gap R3) →
  kaizhangNV redesign (final mechanism: preserveScalarAndVectorPhis for direct SPIR-V) + fixer CI repair →
  jkwak-work + kaizhangNV approvals → merged. ~6% regression fixed in master, both pipelines 7 OpPhi.
- **11-18 06:43Z — kaizhangNV also APPROVED** (review 5951880638); both engaged maintainers signed off
  (jkwak-work 5944160849 + kaizhangNV). Merge is theirs to execute; on the MERGED/CLOSED webhook the fixer
  cleans up worktree + sentinel. Terminal on merge.
- **R3 — reporter follow-up (11-17 01:04Z): the `-minimum-slang-optimization` gap, fixed. New head
  `5d4ed9783`** (verified live; commits 7add4c14b + test-pin fixup; CI re-triggered; PR reply to reporter
  with measured numbers cmt 6934383282). The reporter measured that with their production flag the PR still
  gave 8 OpPhi: that pipeline runs no SSA promotion → the hoisted var never becomes a phi (eliminate-phis
  materialization never applies) and the uninit-load store doesn't survive — only a concrete constant store
  does. Fix evolution: the per-entry init at both hoist sites now stores a concrete default
  (`emitDefaultConstruct(type, false)`) for scalar/vector/matrix/non-UserPointer pointers (the reporter's 15
  production stores are all in that set); aggregates/opaque keep the uninitialized-memory store (#11011
  no-aggregate-zero-fill contract intact — struct tests pin the undef store, SPV-NOT zero-composite checks
  green; type gate moved to slang-ir-util, shared with phi elimination). Reporter's exact flow: 7 OpPhi in
  BOTH default and minimal pipelines (minimal was 8 before); spirv-val clean; targeted 27/27, tests/bugs
  1054/1054, autodiff 1030/1030 + 63/63; fresh codex PLAN/CODE/OUTPUT approve (CODE nits applied).
  **Awaiting: reporter retest of their production raygen (fixer asked on the PR; fixer's read of their data
  says this should recover what they measured), then kaizhangNV review.** Rung 4 respected (PR-side
  comments only). Operator decision ask on the dashboard (id 97, jkwak-work remark handling) still pending;
  reporter's measured engagement further supports the compiler-side read.
- **22:03Z jkwak-work comment (6930739226): "This is a known problem and we think that it is a driver side
  bug."** — reads as contradicting the chain's compiler-side evidence (OpPhi 8-vs-7 measured in SPIR-V
  text, no driver involved; revert restores both shape and timing). No maintainer review on PR #14502 at
  that point; PR unchanged (draft, 7e745957e then). Relayed verbatim to the triager (id 93, pinned) with
  verified context + the #14415 conflation possibility; no bot reply authorized (rung 4, no mention).
- **Triager assessment (22:0xZ, received): blame disagreement, most likely conflation with #14415 — NOT a
  ruling, NOT stand-down grounds.** Signals: no `Vendor Driver Bug` label (his tell in #14415), no assignee
  change, no close request; mechanism uncontestable (OpPhi measured in disassembly); fix valid under either
  reading. Non-argumentative clarification drafted + HELD at the triager's memory/issues/comment-14493.md.
  Fixer FYI'd (worktree stays parked; don't flip ready expecting imminent merge). **Operator decision ask
  posted to the dashboard (msg id 97): relay the held clarification or default to watch-only.** No timer
  minted: webhooks + parked register + weekly ready-flip list cover the watch state.

**11-18: fix merged + close dispatched.** Our draft PR #14502 "Preserve scalar and composite SSA in direct SPIR-V emission"
MERGED 2026-11-18T08:03:39Z (its 06:41Z merge-group CI failure was transient; assignee kaizhangNV). Issue close-with-resolution
dispatched to slang-triager (housekeeping-closes-2026-11-18). Chain terminal on close.

**11-18 08:27Z outcome:** the triager posted the resolution comment (6973165188, cites merged #14502) but its guardrail vetoes
bot-closing issues (maintainer-only) — #14493 stays resolved-but-open; a human maintainer (assignee kaizhangNV) closes it.
