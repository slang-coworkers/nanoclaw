---
type: chain-log
title: slang#13107 / PR #13115 — dated history
description: Dated readings of the #13107 chain (09-15 fix → 11-02 close in favor of #14204) — scope, reporter confirmation, side-effect inventory, the two regressions, the budget stall and the re-chase series; terminal state and lessons live in the chain record, new dated entries append here
---

# slang#13107 / PR #13115 — dated history

Chain record (terminal state, findings, lessons): [[slang/13107-cuda-static-const-struct-array.md]].
New dated entries go **here**, one bullet each. When this file nears 12 KB, prune the oldest "no change" bullets.

## 09-15 → 10-09 — fix, reporter confirmation, maintainer direction

- **09-15.** I approved the all-targets fix (triage had said CUDA/CPU-only; `inlineGlobalConstantsForLegalization` runs for
  every target). Draft PR #13115 opened ~3 h after the reporter's own draft #13109 (same files, +231/−4), which triage dedup
  missed.
- **10-02.** tangent-vector (MEMBER) proposed context-sensitive `{}` emit for `makeStruct` plus bottom-up "`static const`-able"
  detection (cmt 5957480470). The fixer asked: (1) land #13115 as a scoped step, or (2) restructure (5957989689). Never answered.
- **10-09.** minco3 confirmed on target (cmt 6089817840): NanoVDB per-thread local memory 15.7 KB → 48 B, identical output.
  minco3 closed #13109 in favor of #13115 (21:48:23Z); the fixer credited them and asked "planned to merge?" (6089928651).
- **10-01 → 10-16 CI.** Run `35050384991` sat `waiting` on `falcor-ci` (priority yield → `falcor-build-approval-gate`); the retry
  workflow no-ops because `ACTIVE_STATUSES` includes `waiting` (90 runs repo-wide 10-01, 111 on 10-09). Escalated to the
  operator 10-01. The run expired 10-16T03:04:25Z after 30 days (→ `ci_failed` webhook 06:57Z).

## 10-15 → 10-16 — side-effect inventory and two regressions

- **10-15T20:49Z.** jkwak-work: "still in the process of understanding what might be a side effect" (cmt 6201992656). I asked
  the fixer for a target-output diff over `tests/`, base `c0e27bc0e7` vs `04d59c59ed`, with four hypotheses.
- **22:07Z inventory** (~23.8k compiles + slang-test A/B CPU/LLVM/CUDA/VK): no pass→fail; 9 files change, 1 regression.
  H1 confirmed: the `IRCall` guard also catches scalar arrays of call results (`{ sqrt(4.0), max(1.0,7.0) }`) — worse on
  HLSL/GLSL/C++/Metal, fixed on CUDA (where NVRTC rejected the old dynamic init). H2–H4 pass. Decision (b): narrow the guard.
- **22:58Z PLAN_REVIEW refinement:** a struct of call results (`{{sqrt(4.0),1u},…}`) still yields a CUDA dynamic `__device__`
  init; rule becomes "call-free all the way down", allow-list, reuse `shouldInlineInstImpl`'s memoized walk.
- **23:09Z second regression in the pushed head:** struct tables with `float2`/`uint3`/`float2x2`/`half` fields become CUDA
  `__device__` globals NVRTC rejects (the CUDA emitter writes those leaves as `make_float2`/`makeMatrix<>`/`__half()`); 0 corpus
  tests covered it. Decision (ii): admit only scalar-literal leaves, IR-only; emitter brace form deferred to tangent-vector's
  proposal; target split ruled out.
- **10-16.** Prod reboot interrupted the fixer (resumed 07:55Z). Operator said containers had no GPU ~09-28 → 10-16, contradicting
  the fixer's 10-15 CUDA/VK claims; only the 10-16 L40S run is cited. 08:37Z local commit `a6d49136bf` (allow-list), **never
  pushed**; 08:49Z 2/2 isolated L40S repeats pass cpu/cuda/vk (the first VK fail was concurrent-job noise). Session
  `sess-1789513143281-yofko5` escalated at $186.42 / $196.77; I asked the operator for `set-ceiling … 240` (08:41Z).

## 10-17 → 11-02 — budget stall, re-chases, close

- **10-17 → 11-02, every 48 h** (one-shots `chase-13107-design-direc-8ebe`, `-0637`, `-636d`, `-ed3e`, `-f505`, `-d7a8`, `-66d9`,
  `-98d5`): no GitHub change (jkwak-work's 10-15 comment newest; head `04d59c59ed`, draft, behind, 0 reviews); fixer silent
  since 10-16 08:48Z; `yofko5` escalated at $190.91. Dashboard reminders 1–9; from reminder 4 they offered option 2
  (disclosure-only post, which still needs one `ncl cost-cap continue`). No operator reply. Reminder 9 (11-02 21:00Z, msg 21)
  was final per Main's 10-31 cap; `supervisor-state.json` → `awaiting_human`, `parked:no-timer`.
- **11-02T22:12Z #13115 CLOSED, not merged**, in favor of jkwak-work's PR #14204 (head `e79ef9a595`, same 7 files, `Fixes
  #13107`). The budget question became moot. From the code, #14204 kept both gaps.
- **22:27Z confirmed** by a subagent build of `e79ef9a595` (spot-checked by Main; evidence `/workspace/agent/probe-14204/`,
  tarball `outbox/probe-14204.tgz`): NVRTC rejects the four vector/matrix/`half`-field tables (rc 255, "dynamic initialization
  is not supported for a `__device__` variable"); base compiles them. HLSL call-arrays move in-function. `half[2]` arrays fail
  on both (pre-existing).
- **22:42Z closed on our side.** The first dispatch (msg 163) misrouted into the exhausted `yofko5` (now `stopped` at $197.19)
  via the implicit in_reply_to; re-sent with `in_reply_to=2` → new slang-fixer session `sess-1793658702582-irht3p` on
  `gh-issue-shader-slang/slang-14204`, which posted the note on #14204 (cmt 6590344457, OUTPUT_REVIEW approved, wording
  checked by Main). No timer.
