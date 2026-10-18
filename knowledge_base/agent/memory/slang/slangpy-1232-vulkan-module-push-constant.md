---
type: chain
title: slangpy#1232 — Vulkan module-level [[vk::push_constant]] → silent wrong functional-API results
description: Human-filed (albertrodriguezclo) 10-16. ALL coworker tiers closed 10-17. SlangPy part = draft PR slangpy#1235 (fail loudly, CI green). Upstream = slang#13713 → draft PR slang#13724 (E39033, breaking, error vs warning for kaizhangNV) + slang-rhi#915 (parked). Operator decisions open - #1235 ready, rhi#810 promotion, #915 STAGE_ALL fix now, file the export-fn GLSL follow-up.
resource: https://github.com/shader-slang/slangpy/issues/1232
---

# slangpy#1232 — module push constant + functional API on Vulkan

Reproduced by slangpy-triager on L40S (main b89a3827, Slang 2026.19, rhi e0eeb428); CUDA correct.
Memo: slangpy-triager FS `memory/triage/1232-vulkan-module-push-constant-silent-wrong.md`
(copy sent to Main: `/workspace/inbox/a2a-1792164664476-3xgrrm/`). Repro scripts on the triager FS
`/workspace/agent/repro-1232/`.

## Defects (slangpy-triager's findings)
1. **slang-rhi** `addAllPushConstantRangesRec` (`vk-shader-object-layout.cpp:907-916`) lays the
   global block at 0 and the EP call data at +16; Slang puts both at Offset 0 → the shader reads the global's bytes
   (offset proof: read 7.0 instead of 3.0).
2. **Slang**: an EP that reads both blocks emits two PushConstant interfaces → spirv-val
   `VUID-StandaloneSpirv-OpEntryPoint-06674`, slangc exit 0, no diagnostic. Nearest: slang#9643
   ("Unplanned", multi-stage), slang#7151 closed. Not an exact duplicate.
3. **slang-rhi ParameterBlock path** = slang#12349 mechanism; **slang-rhi#810 fixes it (verified by
   the triager, then reverted)**. See [[project_slang_12349_vulkan_pb_pushconstant_pipeline_layout]].

## Routing (2026-10-16)
- slangpy-fixer: approach A (raise SlangPyError on Vulkan for a push-constant global) → DRAFT PR **slangpy#1235** (10-16 17:04Z), branch
  `fix/issue-1232`, thread `gh-issue-shader-slang/slangpy-1232`.
- slang-triager: defects 1+2 bundled on ONE thread `gh-issue-shader-slang/slangpy-1232/upstream-slang`.
  They are one contract question (who owns the Offset-0 layout), and a second sub-thread in the same group would be refused
  by the one-owner router rule.
- slang-rhi#810: still a DRAFT, last updated 08-05, kaizhangNV assigned. Promotion is human-gated, so I asked the operator.
  One-shot re-check task `rechase-1232-upstream-4666` (10-20 15:00Z).

## Upstream result (slang-triager, 2026-10-16 16:14Z, verified on GitHub)
- Filed **shader-slang/slang#13713** (labels `reproduced`, `Vulkan`; 5-bullet cmt 6219628228) and
  **shader-slang/slang-rhi#915** (`bug`). They cross-link each other and slangpy#1232. Not dups of #9643, #7151 or #5685.
- Verdict: **Slang owns the contract.** Correction to slangpy-triager's memo: reflection gives
  PCB index 0 to the global block and 1 to the EP block. The index comes from a program-wide counter with no byte meaning, and both
  blocks sit at Offset 0. `isParameterLocationUsed(PUSH_CONSTANT_BUFFER)` is false for every index, so rhi can't
  derive offsets from reflection today. The rhi-only part is the overlapping `STAGE_ALL` ranges (VUID-00292).
- Defect 3 (oversize, 260 > 256) NOT reproduced as silent: under render-test, rhi's size check fires.
  The silent case is probably on the SlangPy side. Approach A (raise on any push-constant global) covers it anyway.
- slang-fixer: approach A, a per-EP diagnostic when one EP statically uses more than one push-constant block. Session
  `sess-1792167153964-gl1h7u`. Layout and rhi#915 offset fix parked for a Slang maintainer; triager re-check 10-20 15:00Z.
  Triage memo: `/workspace/inbox/a2a-1792167264680-9xh893/triage-13713.md`.

## PR #1235 (10-16 17:09Z, slangpy-triager report)
- Draft, head `5d60c9d`, `Fixes #1232`; triage comment 6218899535 edited in place to link it.
- Open review point (the fixer flagged it, the triager added evidence): the check also blocks `Function.dispatch` with **no** EP uniforms.
  The triager's raw kernel `glob_pc` (global resource + push constant, no EP uniforms) gives correct
  results today, so the check may over-block. The scope is for the reviewer, then a maintainer, to decide.
- 10-16 17:30Z: the fixer narrowed the raw `Function.dispatch` check after the glob_pc evidence; head `ceb9a9a`. HTML explanation:
  `/workspace/inbox/a2a-1792171827649-jpas1i/`. Still waiting for the `[Fix Report]`, which will say whether glob_pc passes on both builds.
- 10-16 17:35Z fixer report: the glob_pc over-block was confirmed and fixed. `Function.dispatch` now raises only when the kernel has EP uniforms
  or the module has a global ParameterBlock. pb_data (OK on main) is now blocked, which is conservative: it breaks only when the push constant is alone
  in set 0 (#12349), and SlangPy deliberately does not re-derive rhi set numbering. New tests 12/12 vk+cuda; full suite 3688 pass, 51 fail
  (50 git-lfs failures + `test_compilation_reports[vulkan]`, both failing on baseline too). Explanation cmt 6220677658; issue status cmt 6221146751.
  Next: slangpy-reviewer verdict on `ceb9a9a8`, then the `[Fix Report]`.
- 10-16 18:34Z: review round 1 was REQUEST_CHANGES, both gaps fixed at head `52e815d6`. G1: a push constant in an `import`ed module was missed, so the check now
  also runs on the linked program. G2: a ParameterBlock EP argument wrote nothing and now raises. Revert drill: 6 of 6 Vulkan cases fail without the fix. Full suite: 3693 pass, 50 fail
  (all git-lfs). Round 2, the final round, is pending.
- Reviewer's side finding (no push constant): raw dispatch of a global `ParameterBlock` + EP uniform `float k2` writes nothing on Vulkan; CUDA is
  correct. That is exactly the slang#12349 shape (its fix is slang-rhi#810), so it is not a new issue. I added it to the #810 operator decision as further
  evidence. Repro: slangpy-reviewer FS `/workspace/agent/reports/review-1235/probe3`.
- **10-16 19:09Z [Fix Report] (SlangPy part FIXED).** Verified on GitHub: draft PR #1235 head `52e815d6`, 10 files +460/−1, CI 14 check-runs + 2 statuses
  all success. jkwak-work is assignee and requested reviewer. Round 2 was APPROVE_WITH_NITS: N1 applied, N2 (a user global named `call_data` is skipped) declined as low priority.
  The internal reviews were not posted to GitHub. Disclosed: (a) a global PB plus a buffer kernel is now blocked (conservative); (b) an `import`ed-module
  push constant fires VUID 00292 once before the raise, because sgl `link_program` builds the layout; nothing is dispatched. Next: a human decides ready and merge.
  The upstream parts stay with slang#13713 (slang-fixer) and slang-rhi#915 / #810 (operator).
- 10-16 19:12Z [Triage Resolution]: slangpy-triager tier CLOSED. Cmt 6218899535 edited to fixed-pending-merge, linking #1235, #13713,
  rhi#915 and #12349. It reopens on a human comment, a PR state change, or an upstream fix landing. All coworker tiers on the SlangPy side are closed.
- 10-16 19:56Z slang#13713 (slang-fixer): full suite is clean (10888/10891; the 3 failures are pre-existing fp8-cuda ones). Self-review found **E39033 false positives**: `-g`,
  discard-dead code, and refs that only spirv-opt removes all trigger the error on shaders that master compiles to valid SPIR-V. The fixer is reworking the check placement
  before opening the PR. Watch for: the rework must not turn valid shaders into errors; no PR yet.
- 10-16 21:45Z: #13713 v2 runs inside SPIR-V legalize after its final DCE, on the emitter's entry-point graph, ignoring debug-only refs and using one shared predicate. The GLSL check is unchanged.
  This addresses 2 of the 3 false-positive classes (`-g`, discard-dead). I asked the fixer about the third (refs only spirv-opt removes, which still sits after legalize) and to record its choice in the PR.
- 10-16 21:53Z: a phantom slang-fixer session `nt0ivf` was minted by my reply on the `…/upstream-slang` thread. It stood down with no changes.
  The v2 ask was re-sent pinned to owner `gl1h7u` on `gh-issue-shader-slang/slang-13713`. Lesson recorded in
  [[feedback_a_thread_id_on_a_message_tag_loses_to_your_own_session_thread]]. **Future replies to slang-fixer about #13713: owner-pinned, on the canonical thread.**
- 21:54Z owner answer on the 3rd false-positive class: with `SLANG_RUN_SPIRV_VALIDATION=1`, master's own pre-opt module already fails 06674 at
  -O0 and -O1 (dead-store, `*0.0`, `extra(false)`); `extra(false)` is still invalid after spirv-opt -O1. So E39033 there is correct, not a
  false positive; the fixer will pin it with a test and justify it in the PR. The `-g` and discard re-run results come in the `[Fix Report]`.
- 10-16 22:25Z #13713 v2 implemented (check runs in `legalizeIRForSPIRV` after the last DCE, plus the GLSL `beforeComputeEmitActions`). 13/13 cases correct: 6 error, 7 clean,
  incl. discard-dead at spirv_1_5. The spirv-opt-only class keeps E39033 by design, with a test pinning it. ⚠️ The fixer says "same for `-g`", which **reverses its 19:56Z
  claim** that `-g` was a false positive on master-valid SPIR-V. I asked for the receipt (master `-g` module + validation result). Full suite running, then CODE_REVIEW, then the draft PR.
- 10-16 22:27Z the `-g` conflict is resolved with receipts. The fixer's 19:56Z "false positive" relayed a subagent claim that had validated master **after** spirv-opt -O1.
  Master's own pre-opt module fails 06674 at -O0 and -O1. The real `OpLoad` of `%entryPointParams` feeds only `DebugValue`, and spirv-val counts that as a use. Test
  `tests/diagnostics/multiple-push-constant-blocks-debug-info.slang`. **Open maintainer question:** at -O1 three shapes ship VALID on master (`-g` unused
  uniform, dead store, `*0.0`; valid only because spirv-opt drops the block) and now get E39033. Error vs warning decides the breaking label, like #13518 Q1.
  The repo rule says an error on existing code that ships fine = `pr: breaking change`, so I told the fixer not to default to non-breaking.
- 10-16 22:43Z the fixer chose **(a)**: keep the error, label `pr: breaking change`, error vs warning → maintainer, citing #13518 Q1 (cmt 6076770596, still unanswered on
  #13541). Matrix (spirv-val v2024.2, vulkan1.2): `-g`/dead-store/`x*0.0` give 06674 at -O0 and are valid at -O1 on master, E39033 in v2; `extra(false)` is 06674 at both; discard is valid and ok.
  Master's pre-opt SPIR-V is 06674 in all 4 error rows, and its GLSL has 2 blocks in every row. Full suite 10896/10899 (3 fp8-cuda failures, all on baseline too). 5 commits re-sliced onto
  origin/master 8c81b8b. Next: re-verify, then CODE_REVIEW, then the draft PR.
- **10-16 23:28Z DRAFT PR slang#13724** (verified on GitHub): head `219e692`, `fix/issue-13713`, 15 files +484/−5, label `pr: breaking change`, `Fixes #13713`,
  kaizhangNV assigned and requested. The body states the breaking risk and the open question (error vs warning, blocks merge). Explanation HTML:
  `/workspace/inbox/a2a-1792193286053-mu7l5f/`. Waiting on the fixer's `[Fix Report]`, then the kaizhangNV decision.
- 10-16 23:33Z: the fixer has requested peer review from slang-reviewer. CI run 38981310540, explanation cmt 6226597685. Full suite on head 10877/10880 (3 fp8-cuda failures that fail on master too).
  Correction: `extra(false)` is valid on master at **-O2**, so the PR table now has an -O2 column. All 4 error shapes therefore ship valid SPIR-V at some -O level, which strengthens the breaking label.
  Next: reviewer verdict, then `[Fix Report]`, then kaizhangNV on error vs warning.
- 10-17 01:03Z #13724 R1 (slang-reviewer): **REQUEST_CHANGES**, 1 bug, 5 gaps, 3 questions; not posted to GitHub.
  - Bug (reproduced): the GLSL emit skip drops the decl of a push-constant block that an `export` fn still reads, leaving undeclared `push_0`; master's output is valid.
    The reviewer's fix (`!hasUses()`) passes 935/935.
  - Gaps: `// CHECK:` with a space is ignored, so E39033 is never asserted; the test depends on the default SPIR-V version; glslang still runs after E39033;
    the "offset 0" wording is wrong; the "emitted code unchanged" claim is false because `#line` changes.
  - Verified good: 0 regressions, 11/17 new test runs fail on master, each change breaks a test when removed, the breaking label is right.
  - Next: the fixer sends R2.
- 10-17 02:29Z #13724 R2 pushed, head `08e151d` (explanation HTML `/workspace/inbox/a2a-1792204175432-0cm89b/`). Waiting for the R2 verdict and the `[Fix Report]`.
- 10-17 02:35Z R2 fixes (4 commits on top of 219e692, no force-push): the GLSL decl is dropped only when unused and the module has >1 block, with a new test; GLSL E39033 fails the API compile and
  `-emit-spirv-via-glsl` stops before glslang; CHECK lines now assert E39033; wording and `#line` disclosure fixed. An attempt to fail emit on any error for every target broke
  `cooperativeVectorTypeMetadata`, so that check is GLSL-only. Full suite 10881/10884 (3 fp8-cuda failures that fail on master too). Known limit left out of scope: an uncalled `export`
  fn reading one push-constant block while the EP reads another still fails glslang, same as master (direct SPIR-V is fine); listed as a follow-up in the explanation, not filed.
- 10-17 03:58Z #13724 R2 verdict: **APPROVE_WITH_NITS**, 0 bugs. All R1 fixes re-checked. The reviewer wrote the 2 missing load-bearing tests (GLSL unused-block
  check, GLSL early fail exit); each passes on head and fails with the logic removed and on master. Minor nits: a comment, an assert that contradicts a null check, a test comment, user-guide GLSL and
  `-preserve-params` text. The claimed EP `[vk::push_constant]` mislabel did not reproduce. The two-block GLSL case with an exported reader matches master (follow-up). Next: the fixer applies the nits with no further
  round, then `[Fix Report]`. No maintainer has spoken on error vs warning (#13713/#13724/#13518/#13541).
- **10-17 04:39Z [Fix Report] slang#13713 → PR #13724 FIXED (draft)**, verified on GitHub: head `f470d43`, 20 files +613/−5, `pr: breaking change`, kaizhangNV
  assigned, CI 28 skipped + 2 success (normal for a draft), issue status cmt 6229595317. 8 new tests (24 runs); full suite 10884/10887 (same 3 fp8-cuda failures as master). R1
  REQUEST_CHANGES → R2 APPROVE_WITH_NITS, nits applied, no R3. **All coworker tiers on the chain are now closed.** The PR is held for maintainer error vs warning.
  Unfiled follow-up: an uncalled `export` fn reading a second block → GLSL still declares both (same as master); filing is the operator's call.
  Remaining: human decisions only (see the 10-17 dashboard table). Re-check `rechase-1232-upstream-4666` 10-20 15:00Z.
- 10-17 04:45Z slang-reviewer confirmed all R2 nits and both pinning tests at `f470d43` (each fails with its logic removed). Review chain COMPLETE. Left open, both minor: 2 optional tests (RT stage, single violating EP) and the `-obfuscate` note printing empty field names.
