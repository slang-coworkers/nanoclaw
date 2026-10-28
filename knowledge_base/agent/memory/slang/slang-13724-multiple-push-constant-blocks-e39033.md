---
type: chain
title: slang#13713 / PR #13724 — E39033 when one entry point uses more than one push-constant block
description: Upstream Slang half of slangpy#1232. MERGED 10-20 22:20Z (69ad6c1) by jkwak-work; E39033 shipped as an error, pr: breaking change; #13713 closed. B/C layout contract left with no Slang tracker (only rhi#915).
resource: https://github.com/shader-slang/slang/pull/13724
---

# slang#13713 → PR #13724 — multiple push-constant blocks per entry point

Parent chain: [[slangpy-1232-vulkan-module-push-constant.md]]. Branch `fix/issue-13713`, label
`pr: breaking change`, kaizhangNV assigned. Owner: slang-fixer `sess-1792167153964-gl1h7u` on
`gh-issue-shader-slang/slang-13713`. The layout fix itself and slang-rhi#915 are parked for a maintainer.

## Design (approach A)
- Per-EP diagnostic E39033 when one EP statically uses more than one push-constant block. v1 ran too early
  and fired on `-g`, discard-dead code and refs only spirv-opt removes. v2 runs in `legalizeIRForSPIRV`
  after the final DCE, on the emitter's entry-point graph, plus the GLSL `beforeComputeEmitActions` path.
- **Those were not all false positives.** Re-validated pre-opt with `SLANG_RUN_SPIRV_VALIDATION=1`, master's
  own module already fails 06674 for `-g` (the real `OpLoad` of `%entryPointParams` feeds only `DebugValue`,
  which spirv-val counts as a use), dead-store, `x*0.0` and `extra(false)`. The 10-16 19:56Z "false
  positive" relayed a subagent that validated **after** spirv-opt -O1. Discard-dead is valid and stays clean.
- Breaking: all 4 error shapes ship **valid** SPIR-V on master at some -O level (`-g`/dead-store/`*0.0` at
  -O1, `extra(false)` at -O2) because spirv-opt drops the block, and now get E39033. The repo rule (an error
  on existing code that ships fine = breaking) made the fixer keep the error + breaking label and hand error
  vs warning to the maintainer, citing #13518 Q1 (cmt 6076770596, unanswered on #13541).
- GLSL: the emit drops a push-constant block decl only when it is unused and the module has >1 block;
  GLSL E39033 fails the API compile and `-emit-spirv-via-glsl` stops before glslang.

## Review and verification
- R1 (slang-reviewer) REQUEST_CHANGES: the GLSL skip dropped a block an `export` fn still read (undeclared
  `push_0`); `// CHECK:` with a space was ignored so E39033 was never asserted; default-SPIR-V-version
  dependence; glslang ran after E39033; wrong "offset 0" wording; false "emitted code unchanged" (`#line`).
- R2 APPROVE_WITH_NITS, 0 bugs; the reviewer added 2 load-bearing GLSL tests (each fails with its logic
  removed and on master). Nits applied at `f470d43` (20 files +613/−5, 8 new tests / 24 runs).
- Full suite stays at the 3 fp8-cuda failures that also fail on master (latest 10884/10887).
- Out of scope, unfiled (operator call): an uncalled `export` fn reading a second block still makes GLSL
  declare both, same as master. Minor optional: RT-stage and single-violating-EP tests; `-obfuscate`
  note prints empty field names.

## Maintainer round (10-20)
- jkwak-work (MEMBER) left 3 inline requests 01:41–01:49Z (remove a comment, drop the GLSL-only fail
  condition, inline the helper) and **marked it ready** 01:49:28Z. Fixer applied all 3 → head `ee9df25`,
  no force-push, replied per thread, left threads unresolved.
- Widening `emitEntryPointsSourceFromIR` to fail on any emitter error on every target made
  `cooperativeVectorTypeMetadata` drop `cuda_optix` (it passed only because E55204 errors were ignored);
  disclosed in the body and the thread.
- CI on `ee9df25`: workflow_dispatch run 39359074408 **yielded** (wait-for-human-priority, by design);
  pull_request run 39359079741 waits on `falcor-build-approval-gate`.
- The fixer's report said "PR stays draft" — wrong, report-only (nothing on GitHub says draft); corrected.
  jkwak-work's review body was empty, so error vs warning is still open.
- **10-20 14:08Z jkwak-work APPROVED #13724** ("Looks good to me", review 5586232671, verified) at `ee9df25` and resolved all 3 threads. The approval leaves error vs warning unaddressed.
  14:14Z the fixer posted status cmt 6292930362 asking jkwak-work whether the approval keeps E39033 as an error; on yes it removes the "Open question (blocks merge)" line. CI run 39359079741 is
  still `waiting` at `falcor-build-approval-gate`; the PR is `behind` main. The bot has not re-dispatched, merged or relabeled. Remaining: maintainer answer + CI approval + merge.
- 10-20 15:02Z slang-triager re-check, verified: jkwak-work is assignee of #13713 and rhi#915 (both milestone Q4 2026 (Fall); rhi#915 is Type Bug, 0 comments). Nobody has
  given direction on B/C (non-overlapping layout or usage metadata) or the rhi offsets. **New operator decision:** the #13724 body says `Fixes #13713` (line 7), so the merge closes #13713 and leaves
  B/C with no open Slang tracker (rhi#915 still tracks the rhi side). Options: (a) change the keyword to `Part of #13713`, (b) file a follow-up issue for B/C after merge, (c) let it close, with rhi#915
  as the only tracker. The triager files nothing itself and will re-check t-83bd76 on 10-27 15:00Z.
- 10-20 15:03Z the one-shot `rechase-1232-upstream-4666` fired (session `ncywgt`) with its 10-16 prompt; a running task can't be updated. Main sent the consolidated dashboard update at 15:05Z, so if the task re-raises the same operator items, that is a known duplicate.
- **10-20 15:00Z re-check:** PR CI run 39359079741 finished `cancelled`. Every test job passed (last one
  `test-windows-debug-cl-x86_64-gpu-vk`, 14:53Z); only `falcor-build-approval-gate` was cancelled 14:06Z.
  In dispatch run 39359074408 the Falcor gate passed 14:09Z and `test-falcor` is still running. The PR is
  10 commits behind master. The error vs warning answer is still pending.
- **10-20 22:20Z MERGED** by jkwak-work (verified): merge commit `69ad6c1`, head `ee9df25`. #13713 closed `completed` at 22:20:02Z via `Fixes`. E39033 shipped as an
  **error** with `pr: breaking change`; nobody answered error vs warning explicitly (the approval and merge are the answer). The pull_request CI run 39359079741 had 47 jobs succeed, 2 skipped, and 1 cancelled (the falcor gate);
  the run conclusion reads `cancelled` only because of that gate. The fixer cleaned up its worktree and sentinel. **Chain TERMINAL on the Slang side.**
  The operator's auto-close decision was overtaken: option (c) happened by default, so B/C (layout contract) now has no open Slang tracker; only rhi#915 (jkwak-work, Q4) remains.
  Whether to file a B/C follow-up is still the operator's call.
- 10-21 15:51Z jkwak-work @nv-slang-bot on **slang-rhi#915** (cmt 6320216701): thinks the #915 case now errors after #13724 and asks for a re-test. A sibling Main session routed it to the slang-triager owner
  session `6lzbb3`, which acked at 15:59Z (placeholder cmt 6320398694, to be edited in place). **Watch:** the 10-20 measurements (reporter cmt 6303508603, fixer cmt 6303626365) already show
  that #915's `unused` shape compiles clean with #13724 and still returns wrong values. The re-test should confirm that #915 stays open; it should not close it.
- 10-21 16:11Z slang-triager's rhi#915 re-triage at ToT (master `a801f2685`, rhi `b856e635`; rhi main `a0619ac` has no push-constant change), cmt 6320398694 edited in place:
  the 10-20 evidence is CONFIRMED. read push + EP uniform → E39033; `unused` (#915 repro) → wrong values `7 8 9 10` (VUID-10069); **VUID-00292 still fires** wherever
  both blocks are declared. Refinement: read push only with `k` declared and unused → E39033 under default `-g` (by design, debug-info test), but correct with `-g0`. **#915 stays open**, with 2 rhi
  defects: (1) the EP +16 offset, which needs a direction: (a) usage metadata slang#5685, (b) a Slang layout with reflected byte offsets (no tracker since #13713 closed; triager offered to file), (c) rhi-only (partial);
  (2) the 00292 overlap, which rhi can fix alone. No fix dispatched; re-check t-83bd76 10-27.
- 10-27 15:04Z slang-triager re-check t-83bd76: no movement since 10-22, verified (rhi#810 untouched since 08-05, #915 last activity is our 10-21 edit, #12349 since 08-26, #1235/#1232
  unchanged). B/C has no open Slang tracker; #5685 (usage reflection) has been idle since 2025-05. Two operator decisions from 10-21/10-22 are still unanswered: (1) mark #810 ready + cross-link,
  (2) file the B/C Slang tracker, plus the 00292 narrow rhi PR. Next triager one-shot: t-0df978 on 11-03 15:00Z.
