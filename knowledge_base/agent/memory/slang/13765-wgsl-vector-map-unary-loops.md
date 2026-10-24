---
type: chain
title: slang#13765 — WGSL emits vector rsqrt/fmod/f32tof16/f16tof32/isnan/isinf/isfinite as per-component loops
description: "Human-filed (albertrodriguezclo) 2026-10-20 WGSL codegen-quality issue: VECTOR_MAP_UNARY loops. Related to #13733/PR #13740. Routed to slang-triager."
---

# slang#13765

- Filed 2026-10-20 12:48:58Z by albertrodriguezclo (same reporter as #13733/#13739). On WGSL, the vector
  overloads fall through to `VECTOR_MAP_UNARY` and become helper functions with a `loop`. Scalar `rsqrt` is emitted as
  `1.0/sqrt`. Expected: `inverseSqrt`, `%`, whole-vector bit tests, and per-component constructors. Impact: a Tint
  robustness counter on each loop (#13733).
- 12:5xZ live read clean: OPEN, 0 comments, no labels/assignee, updated_at == created_at, no timeline refs, no PR.
  The only session on the thread was my own webhook session. Dispatched to slang-triager on
  `gh-issue-shader-slang/slang-13765`. I asked the triager to say how PR #13740 interacts with this issue, to check for a reporter PR,
  and to look at #10531 for dedup. No fixer until the triage is back.
- 12:53Z triager progress (their finding, not re-run by me): reproduced on master 7251cc6, 5 loops; Dawn/Tint on the
  L40S adds robustness counters. No reporter PR yet. The triager is checking whether #13740 removes the counters, then will post the triage.
- 13:18Z `[Triage]` (triager's findings; I checked the GitHub side live): enhancement / medium / P2, WGSL emit + core module.
  Not a dup of #10531, not a regression (2026.13.1 has the same 5 loops). Cause: 9 vector overloads have no `case wgsl:`, so they
  fall to the `VECTOR_MAP_*` loop default (`hlsl.meta.slang:7957`); `inverseSqrt` appears nowhere in the tree.
  - **#13740 interaction (measured by the triager @d266ea6 on Dawn):** counters 5→1; the remaining one is the one-trip inline wrapper
    around `[ForceInline]` vector `fmod`. Loops, per-component calls and `1/sqrt` remain, so the issue is **not moot**. No conflict with A.
  - Options: **A (rec)** per-function `case wgsl:` arms (`inverseSqrt`, `%`, vector bit test, `isfinite` via the existing arm,
    `[ForceUnroll]` for f16 packs, `$TR`); B `[ForceUnroll]` on all 143 VECTOR_MAP/MATRIX_MAP sites (all targets, needs a core-module
    maintainer); C emitter unroll (rejected). Risk: `inverseSqrt` is 2 ULP and indeterminate for x<=0; the f16 arms were not validated (no shader-f16 on Dawn).
  - Public: cmt [6291764231](https://github.com/shader-slang/slang/issues/13765#issuecomment-6291764231) (verified: nv-slang-bot,
    only comment), `reproduced` + Type=Feature (verified). It asks the reporter whether they plan a PR. Memo:
    `/workspace/inbox/a2a-1792502283602-axcfih/triage-13765.md`.
  - **Fixer HELD** (same pattern as #13739, where the reporter opened #13764 themselves). One-shot `recheck-13765-fixer-*` 10-23 15:00Z:
    reporter PR → triager verifies it; declined or maintainer go → dispatch A to slang-fixer; silent → ask the dashboard.
  - Side findings, UNFILED, operator call: (1) the one-trip inline wrapper survives when the callee has a loop, on all targets
    (hypothesis `isTrivialSingleIterationLoop`, `slang-ir-simplify-cfg.cpp:108`, unverified); (2) `isnan(half3)` on WGSL gives E41400 from a
    static_assert, and the `isinf` assert message at :12831 says "isnan".
  - Triager worktree with the #13740 slangc build: `wt-13765-pr13740` (keep it for a comparison run; clean up after the chain closes).
- 2026-10-20 14:20Z: **the reporter committed to a PR for A** ([cmt 6293056692](https://github.com/shader-slang/slang/issues/13765#issuecomment-6293056692),
  re-read live: unedited, no @nv-slang-bot). Scope: FileCheck in `tests/wgsl/math-vector.slang` / `math-scalar.slang`, plus the isinf
  static_assert message fix; the `inverseSqrt` x<=0 caveat goes in the PR description. Out of scope: `isnan(half3)` E41400 and the one-trip inline
  wrapper. They offered to file those separately. **The reporter owns the fix, so no fixer.** No bot reply needed (nothing was asked of the bot). The recheck
  `recheck-13765-fixer-95b6` was repointed: PR → the triager verifies it; no PR → a dashboard line. Side-finding filing: the operator decides, and the reporter's offer was passed on.
- 14:21Z: the triager acked. Acceptance criteria they will check on the reporter's PR: `r_vec.slang` and the probe `half.slang` compile to WGSL with 0 loops;
  Dawn adds 0 counters; scalar and vector `rsqrt` emit `inverseSqrt`; vector `fmod` emits `%`; isnan/isinf results unchanged for NaN, ±inf and denormals;
  the FileCheck lines are in place. Pending: the operator's answer on accepting the reporter's offer to file the 2 side issues (asked 14:2xZ, dashboard msg 25).
- **2026-10-23 15:00Z one-shot re-check `recheck-13765-fixer-95b6` (live read):** the reporter's PR
  [#13781](https://github.com/shader-slang/slang/pull/13781) was opened 10-20 14:51Z, `fix/wgsl-vector-math-no-loop`. It **MERGED 10-22 22:31:50Z**
  (by jkwak-work, merge `7036ae6dfd25`; jkwak-work requested changes, then approved). `Fixes #13765`, and the issue is **CLOSED** 10-22 22:31:52Z (assignee jkwak-work).
  No issue comments after 14:20Z. Files: `hlsl.meta.slang` +27/-7, `tests/wgsl/{math-scalar,math-vector}.slang`, new
  `tests/wgsl/vector-{math,half-conversion}-no-loop.slang`, and an edit to `generic-minmax-vector-codegen-11075.slang` (the PR unrolls the
  default `VECTOR_MAP_UNARY`, so check for an effect on other targets). Per the decision table I asked slang-triager (thread `gh-issue-shader-slang/slang-13765`) to
  verify it after the merge against the 6 acceptance criteria, to check the cross-target effect of the unroll, and then to clean up `wt-13765-pr13740`. No GitHub post, no fixer.
  Side findings (isnan(half3) E41400 and the one-trip inline wrapper): **still unfiled**. The reporter filed 15 other issues 10-20..22, but not these.
  The operator decision is still pending (dashboard msg 25). **Next:** the triager's verification report. Then the chain is terminal, unless a regression is found (then file or route it).
- 10-23 15:02Z triager progress (their claim, unverified): #13781 puts `[ForceUnroll(4)]` on **every** `VECTOR_MAP`/`MATRIX_MAP`
  fallback on all targets. A loop with more than 4 iterations then fails to unroll, and the unroll pass reports that as a hard error. They are building
  7036ae6^ vs 7036ae6 to diff codegen and to find out whether any vector or matrix shape can reach that error. If one can, this is a post-merge regression and needs a new issue (operator / maintainer jkwak-work).
- **10-23 15:22Z: TERMINAL.** The triager's report (msg 8) compared 5311fe859 with master d29325a7f, which contains 7036ae6. **All 6 criteria pass.** WGSL loops: `r_vec` 5→0, `half` probe 8→0.
  Dawn robustness counters went to 0. isnan/isinf/isfinite runtime results are identical over 16 bit patterns on WebGPU/L40S. `rsqrt` differs only in the last bit. Cross-target: `[ForceUnroll(4)]`
  on every `VECTOR_MAP`/`MATRIX_MAP` (I confirmed it myself at `hlsl.meta.slang:8004-8016` @7036ae6) unrolls the loops on all targets. The slang-test sweep on cpu/cuda/vk/llvm passed 7453/7453, and downstream compiles were OK.
  **No regression.** The only change: matrices with more than 4 rows (e.g. `sin(matrix<float,5,4>)` on cpp/cuda) were already rejected, with E38206. They now fail with the less clear E40020 "loop
  unrolling failed". A possible small follow-up, the operator's call, not filed. Side findings (isnan(half3) E41400 and the one-trip inline wrapper) are still unfiled; the operator decides.
  Triager incident (theirs, fixed): the worktree `wt-13765-pr13740` had already been removed. Their `git checkout --detach` then ran in their own main checkout and left it detached for about 25 min. They restored master
  and rebuilt Release. Worktree pruned, temp branch deleted. A gateway 401 on one paginated `gh` call looked transient. Nothing left to do on the chain.
