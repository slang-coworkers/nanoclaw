---
type: chain
title: slang#13107 — static const struct arrays emitted as invocation-local
description: External codegen-quality bug, P2. Fix in DRAFT PR #13115 (held), confirmed on-target by the reporter 10-09. Merge is waiting on maintainers picking a direction (tangent-vector 10-02) and on CI, which has never run (falcor-ci deadlock).
tags: [slang, cuda, ir, legalize-global-values, static-const, optix]
---

# slang#13107 — `static const` struct tables rebuilt per invocation

Reporter **minco3** (external, NONE). Canonical thread `gh-issue-shader-slang/slang-13107`.
Owner: **slang-fixer** (branch `fix/issue-13107`, draft PR **#13115**, head `04d59c59ed`).
Assignee and requested reviewer on #13115: **jkwak-work**.

## Facts (verified on GitHub; re-read before relying on them)

- **Scope is all targets, not CUDA-only.** Triage said CUDA/CPU-only; that was wrong.
  `inlineGlobalConstantsForLegalization` runs for HLSL/GLSL/SPIR-V/Metal/WGSL/CUDA/CPU. I
  approved the all-targets fix on 09-15. SPIR-V at `-O3` already folds to a module-scope
  `OpConstantComposite` on master; the difference shows at default opt and `-O0`.
- **Mechanism (fixer's finding, matches my diff read):** the repro's elements are real `IRCall`s
  to the synthesized `$init`, not a `makeStruct` printed as constructor syntax. #13115 folds those
  calls to `makeStruct` and lets `isSimpleConstantType` recurse into POD struct fields, plus an
  `IRCall` legality guard. It makes no emitter change.
- **On-target confirmation (minco3, 10-09, comment 6089817840):** with #13115 on stock 2026.16.1,
  NanoVDB program per-thread local memory drops from 15.7 KB to 48 B. That matches their source
  workaround, with identical VRAM and image output.
- **#13109 was the reporter's own draft PR**, opened 2026-09-15T22:46Z, about 3 h *before* #13115,
  touching the same files (+231/−4). Triage dedup missed it (the triage memo never mentions it), so
  the bot opened #13115 alongside it. minco3 closed #13109 on 10-09T21:48:23Z in favor of #13115.
- **Reporter answered (10-09, comment 6089928651):** the fixer thanked minco3, credited their numbers
  and #13109, and put "planned to merge?" to @tangent-vector and @jkwak-work by name. Branch untouched.
- **Maintainer direction is open.** tangent-vector (MEMBER) proposed on 10-02 (comment 5957480470,
  edited 17:16Z to add a 3rd paragraph): context-sensitive `{}` emit for `makeStruct`, plus a
  bottom-up "`static const`-able" detection. The fixer asked (5957989689) whether to (1) land #13115
  as a scoped step or (2) restructure around bottom-up detection. Still unanswered at 10-09.
- **CI has never run a build on #13115.** Run `35050384991` is parked `waiting` (priority-yielded,
  then `falcor-build-approval-gate` → env `falcor-ci`). The retry workflow no-ops repo-wide because
  `ACTIVE_STATUSES` includes `waiting`: 90 waiting runs on 10-01, 111 on 10-09. I escalated this to
  the operator on 10-01; it's unresolved. The PR is `BEHIND` master.

- **jkwak-work engaged (10-15T20:49Z, comment 6201992656):** "I am still in the process of understanding
  what might be a side effect from the proposed PR." This is the first maintainer activity since 10-02. The
  orchestrator asked slang-fixer for a data-driven side-effect inventory: target-output diff over `tests/`,
  merge base `c0e27bc0e7` vs `04d59c59ed`. Hypotheses to check: (1) the `IRCall` guard now inlines *every*
  module-scope call, not just constructors (on the merge base, a scalar-typed call stayed global); (2) Metal
  `constant` address space vs by-value or `in` parameters; (3) other struct-typed globals flipping to global;
  (4) pass-order drift in the 11 master commits to `slang-emit.cpp`. Rebase checked locally only, nothing
  pushed. Per the 10-13/14 finding, maintainer engagement is what clears the falcor-ci gate.

- **Side-effect inventory (fixer, 10-15T22:07Z):** A/B compilers built from the PR's 3 files on base
  `c0e27bc0e7` vs fix `04d59c59ed`, about 23.8k compile runs plus a `slang-test` A/B on CPU/LLVM/CUDA/VK.
  Result: no pass→fail and no compile→fail. 9 files change output: 2 are the PR's own tests, 6 are the
  intended fold, 1 is a regression. **H1 confirmed:** the `IRCall` guard also catches scalar arrays of
  call results (`static const float t[2] = { sqrt(4.0), max(1.0,7.0) }`). They move from module constant
  to per-invocation on HLSL/GLSL/C++/Metal (worse) and are fixed on CUDA, where NVRTC rejects the old
  dynamic init (a pre-existing bug, separate). H2 (Metal `constant` binding), H3 (other changed files are
  the intended fold) and H4 (local merge `9baaf5cfa7` clean, not pushed) all pass. **Decision (b):** narrow
  the guard to struct-bearing calls, pin the scalar-array case with a test, re-run the inventory, then post
  to jkwak-work as "found and removed". One commit on `04d59c59ed`, no rebase.
  **Refinement (10-15T22:58Z):** PLAN_REVIEW caught a gap in literal (b). `static const Record r[2] =
  {{sqrt(4.0),1u},{max(1.0,7.0),2u}}` would produce a CUDA dynamic `__device__` initializer that NVRTC rejects
  (the outer `makeStruct` isn't a call, but its operands are). Revised rule: a struct-bearing value stays
  global only if it's call-free all the way down, built only from constant data (prefer an allow-list); plain
  types are judged by type only, as on base. Reuse the memoized walk in `shouldInlineInstImpl`. Pin with a
  CUDA test plus the NVRTC-gated PTX test.
  **Second regression, already in pushed head `04d59c59ed` (10-15T23:09Z):** struct tables with
  vector, matrix or `half` fields (`float2`, `uint3`, `float2x2`, `half`) become CUDA `__device__` globals
  that NVRTC rejects as dynamic init. Base accepts them (inlined); a `-cuda` runtime run fails on the head.
  Cause: the CUDA emitter writes those leaves as constructor calls (`make_float2`, `makeMatrix<>`,
  `__half()`). The corpus has 0 such tests. minco3's two-`uint` table is unaffected. **Decision (ii):**
  newly admitted struct values are limited to scalar-literal leaves, so everything else matches base,
  IR-only. Emitter brace-form support (i) is deferred to tangent-vector's R1/R2 proposal; a target split
  (iii) is ruled out. Disclose it on GitHub as found in the pushed head.
- **Interrupted by the prod reboot (10-16 00:16Z).** The fixer received decision (ii) at 23:10Z but did
  nothing after it. Resumed at 07:55Z (msg 127). The operator says containers had **no GPU from about
  09-28 to 10-16**, which contradicts the fixer's 10-15 claims of CUDA/VK lanes "on the L40S" and a
  `-cuda` float2 runtime failure. The fixer will re-run them on the GPU, check logs for skips, and correct
  them if they were skips. NVRTC `-target ptx` results are compile-only and stand.
- **CI run `35050384991` expired at 10-16T03:04:25Z** after 30 days pending on `falcor-ci` with no
  approval (`falcor-build-approval-gate` → failure, which raised a `ci_failed` webhook at 06:57Z). #13115
  now has no CI run; the next commit dispatches a new one. 99 runs repo-wide `waiting` (10-16).
- **Decision (ii) implemented (fixer, 10-16T08:37Z):** local commit `a6d49136bf` on `04d59c59ed`, **not
  pushed**. Allow-list = `makeStruct`/`makeArray` of scalar literals only; the fold rolls back when the table
  is inlined anyway. Inventory: only intended changes. NVRTC base = new on all 16 leaf types. L40S re-run
  today: the `float2` table fails cuda on `04d59c59ed` and passes on the new head; one VK fail on the new head
  with SPIR-V byte-identical to base (repeat pending). The fixer's 10-15 logs show CUDA/VK lanes executing,
  which contradicts the operator's no-GPU window; cite only the 10-16 run.
  **Blocked on budget:** session `sess-1789513143281-yofko5` is escalated at $186.42 / $196.77 ceiling
  (group p95 $140.86). Asked the operator to `set-ceiling … --ceiling 240`. Push, PR body and comment go out
  together, after the PLAN_REVIEW approve.
  **VK settled (10-16T08:49Z):** 2/2 isolated L40S repeats pass cpu/cuda/vk on `a6d49136bf`; the first
  VK fail was concurrent-job noise. float2 table: base pass · `04d59c59ed` cuda FAIL · `a6d49136bf` pass.
  The fixer's resume notes: its `memory/fix-13107.md`. Still waiting on the ceiling raise.
- **Re-check 10-17T21:00Z:** no change on GitHub. jkwak-work's 10-15 comment is still the newest; no inventory posted; head `04d59c59ed`, `behind`, draft. Fixer is holding `a6d49136bf` unpushed; session `yofko5` is `escalated` at $190.91 / $196.77 and the 10-16 08:41Z ceiling ask (240) is still unanswered. Sent one reminder to the dashboard. The fixer was not nudged, because its hold is on my instruction and its budget. Next check 10-19T21:00Z via new one-shot `chase-13107-design-direc-8ebe` (a fired one-shot cannot be `update`d; create a fresh one).
- **Re-check 10-19T21:00Z:** still no change on GitHub (jkwak-work 10-15 comment is still the newest; head `04d59c59ed`, draft, `behind`; no reviews). Fixer last spoke 10-16 08:48Z and is holding `a6d49136bf`. Session `yofko5` is still `escalated` at $190.91 / $196.77 and the ceiling ask is about 84 h old. Sent the second dashboard reminder (msg 19). Next check 10-21T21:00Z via one-shot `chase-13107-design-direc-0637`.
- **Re-check 10-21T21:00Z:** still no change on GitHub (jkwak-work's 10-15 comment is still the newest; head `04d59c59ed`, draft, no reviews). Fixer last spoke 10-16 08:48Z. Session `yofko5` is still `escalated` at $190.91 / $196.77, and the ceiling ask is about 132 h old. Sent the third dashboard reminder (msg 15). Next check 10-23T21:00Z via one-shot `chase-13107-design-direc-636d`.
- **Re-check 10-23T21:00Z:** still no change on GitHub (jkwak-work's 10-15 comment is still the newest; head `04d59c59ed`, draft, no reviews, no inline comments). Fixer last spoke 10-16 08:48Z. Session `yofko5` is still `escalated` at $190.91 / $196.77, and the ceiling ask is about 180 h old. Sent the fourth dashboard reminder (msg 9). It also offers option 2: decline the raise and post a disclosure-only comment instead. Next check 10-25T21:00Z via one-shot `chase-13107-design-direc-ed3e`.
- **Re-check 10-25T21:00Z:** still no change on GitHub (jkwak-work's 10-15 comment is still the newest; head `04d59c59ed`, draft, no reviews, no inline comments). Fixer last spoke 10-16 08:48Z. Session `yofko5` is still `escalated` at $190.91 / $196.77; ceiling ask ~228 h old. No operator reply on the dashboard since reminder 4. Sent reminder 5 (msg 17); option 2 now spells out that a disclosure-only post still needs one `ncl cost-cap continue` allotment. Next check 10-27T21:00Z via one-shot `chase-13107-design-direc-f505`.
- **Re-check 10-27T21:00Z:** still no change on GitHub (jkwak-work's 10-15 comment is still the newest; head `04d59c59ed`, draft, no reviews, `review_comments=0`). Fixer last spoke 10-16 08:48Z. Session `yofko5` is still `escalated` at $190.91 / $196.77; ceiling ask ~276 h old. No operator reply about 13107 on the dashboard since reminder 5 (msg 17 of 10-25). Sent reminder 6 (msg 17), with the same two options. Next check 10-29T21:00Z via one-shot `chase-13107-design-direc-d7a8`.

## Open decisions

1. **Maintainers (tangent-vector / jkwak-work):** option (1) or (2) for #13115. If (2), the fixer
   brings me a rework plan, and I bring it to the operator before the branch changes.
2. **Operator:** the `falcor-ci` CI deadlock, and whether to flip #13115 to ready for the full CI
   matrix.

Re-chase task: `chase-13107-design-direc-d7a8` (succeeds `-f505`, `-ed3e`, `-636d`, `-0637`, `-8ebe`, `-941b`), a 48h one-shot (next 2026-10-29 21:00Z). Earlier it was rescheduled daily; latest check 2026-10-15 20:20Z (no human reply; head `04d59c59`, 181 behind master; 103 runs repo-wide `waiting`). Waiting-run trend: 113 (10-10), 115 (10-11), 105 (10-12), 104 (10-13), 104 (10-14), 103 (10-15). jkwak-work's 10-15T00:45Z removal of `Office-Tess` from #13107 was a bulk relabel across 6 issues, not a reply. Drops are cancellations/errors, not approvals.

- **falcor-ci gate isn't a hard bot-only block (10-13 finding).** Of the last 100 `falcor-ci` deployments, 58 of 59 bot-created ones are `waiting` (27) or `error` (31). The exception is #13171 (`fix/issue-13166`): jkwak-work approved the PR at 10-12T20:31Z, and jkiviluoto-nv approved its dispatch run 38305371148's `falcor-ci` gate 14 s after it was created (20:37Z). So `ci-approvers` will approve a bot run once a maintainer has engaged with the PR. For #13115, that points to the maintainer decision as the unblock, not an infra fix.
  10-14 re-tally: of the last 100, 62 of 65 bot deployments are `waiting` (28) or `error` (34). The other two exceptions are both #13378 (`fix/issue-13376`), approved 10-12T21:42Z, about 40 min after jkwak-work's 21:01Z review on that PR. Same pattern: maintainer engagement comes first, then the gate clears.

## Lessons from this chain

- Dedup must include the issue's cross-reference timeline, not just a keyword search. A reporter's
  own PR shows up there within minutes of the issue (`#13109` at +1 s here).
- A webhook comment body is a snapshot. Re-fetch the live comment before relaying it (shared
  learning, 10-02).
