---
type: chain
title: slang#13571 — WGSL matrix negation emitted as `matNxM<f32>(0) - m`
description: "andy-slater, human-filed WGSL codegen bug (P2): unary minus on a matrix emits an invalid single-scalar matrix constructor. Draft PR #13572 awaits jkwak-work (#14179 fold-in held locally); 5 follow-ups filed as #14184–#14188. Current state + lessons; dated log in the history sibling."
---

# slang#13571 — WGSL matrix negation

New dated entries go to the history sibling: [[13571-wgsl-matrix-negation-history.md]].

## Current state (as of 11-03 18:53Z)

| Field | Value |
|---|---|
| Issue | #13571 OPEN, bug / P2 / target-emit (WGSL), labels `WebGPU` + `reproduced`, milestone Q4 2026 (Fall) |
| PR | draft [#13572](https://github.com/shader-slang/slang/pull/13572) `fix/issue-13571` @ `5be2d78f1b` (master merged 11-02, no rebase); jkwak-work assignee + requested reviewer, 0 reviews |
| CI | workflow_dispatch run 41452561641 `queued`; pull_request jobs skip while draft. Whoever flips it ready re-triggers CI |
| Owners | triager `sess-1791746794465-t97mo5` (issue side), fixer `sess-1791749819525-d9mn82` (PR side, pr-mapped); canonical thread `gh-issue-shader-slang/slang-13571` |
| Folded in | [#14179](14179-wgsl-vector-negation-signed-zero.md) (vector `-` loses -0) as Part 2, committed **locally only**; **HELD 11-05**: jkwak-work self-assigned #14179, so one-shot `pr13572-r6-push-14179-2403` is cancelled (told the fixer 11:48Z). Do NOT push it on an R6 release. Resume only on an ask from jkwak-work or the operator |
| Needs | a human to mark #13572 ready and re-trigger CI (weekly ready-flip list, no per-PR ask) |

## Root cause and fix

The WGSL `kIROp_Neg` case in `slang-emit-wgsl.cpp` lowered vector and matrix negation to `(T(0) - x)`; WGSL has no single-scalar matrix constructor and no unary `-` on matrices. Not a #12909 regression: the `T(0)` form came with #7936 (v2025.14, mirroring Metal). Triager-recommended fix A: `(T(-1) * x)` for matrices (keeps -0 parity); rejected B `matCxR<T>() - x` (loses -0), C IR legalization, D per-column.

PR diff after the 11-02 master merge: `slang-emit-wgsl.cpp`, `tests/wgsl/matrix-negation.slang`, `tests/wgsl/neg-vector-precedence.slang`. Master's `shouldLegalizeMatrixType` (`bool || isIntegralType`) already covers the PR's earlier `legalizeMatrixTypes` rule, so those files now match master; the emitter assert uses `!isMatrixTypeLegalizedToVectorArray(...)`. Part 2 (#14179, local): the Neg vector branch handles only unsigned-integer vectors; f32/f16/i32 vectors fall through to `- x`; new `tests/wgsl/vector-negation.slang`. PR description (`Fixes #13571` + `Fixes #14179`) is drafted in the fixer's `reports/`.

## Follow-ups (filed 11-02 13:42Z by the triager; bot-authored, filed-only)

Their `issue_opened` webhooks are this chain's own self-echo: **no dispatch, no fixer chains** (starting one is the operator's call).

- #14184 WGSL scalar `uint` `-x` emits `- x`. **Claimed 11-03 by human contributor Pranjulchaurasiya** (local fix in the same `kIROp_Neg` branch) → not folded into #13572; whichever PR merges second resolves a small conflict.
- #14185 CPU prelude `SLANG_MATRIX_UNARY_OP` indexes `result[i].rows[i][j]` (`prelude/slang-cpp-types-core.h`). **11-05 operator asked for a triage verdict; I answered on the dashboard:** still present on master `04d2726db0` (line 629), low / P3, CPU prelude only. jkwak-work self-assigned it (`assigner`=jkwak-work) and set milestone Q1 2027, as he did for all 5 follow-ups on 11-02 18:28Z. No duplicate. No open PR touches the macro (#14012 doesn't touch the prelude). → held (rung 4), no bot fixer unless the operator says go.
- #14186 WGSL BFloat16/FloatE4M3/E5M2 have no type name; likely closes with the [#14159](14159-metal-bfloat16-fp8-undeclared-types.md) fix (that triager's finding, unverified).
- #14187 WGSL float-matrix `%`. **Self-assigned by jkwak-work 11-02 18:22Z, milestone Q1 2027 (Winter) → held (rung 4), no bot fixer.** 11-05 operator asked for a triage verdict: I re-reproduced (Release build 11-02 22:24Z; `m % n` and `m % 2.0` both emit `%` on `mat2x2<f32>`, exit 0; master `04d2726db0` still has only the `kIROp_Mul` matrix branch, line 1821). Verdict sent to dashboard: target-emit (WGSL), low/P3, hold for assignee.
- #14188 WGSL int64/uint64 matrices silently emit `vec2<i64>` (cause #14022: validation runs before `legalizeMatrixTypes`). **jkwak-work self-assigned + milestoned Q1 2027 (11-02 18:22Z)** → held under rung 4, no fixer. Re-verified 11-05 by Main (local Release slangc built 11-02; int64/uint64 2x2 exit 0 with `vec2<i64>`/`vec2<u64>`, int64_t2 control gets E38203; no master commit to validate/legalize-matrix since 11-02). Operator asked for triage 11-05 (dashboard msg 32): verdict = WGSL IR validation/legalization pass order, diagnostic regression, low/P3, blocked on #13914 (also jkwak-work's) for the expected result.
- Duplicates, not filed: double-matrix ICE = #10232; uint8/int8 matrix ICE = #10234; HLSL undeclared `BFloat16Type(...)` = #14159.

## Lessons

- Old gated `waiting` workflow_dispatch runs get deleted repo-wide (run 38259151868 → 404 by 10-20, same as #13590's), so a long-parked draft has no CI to point at.
- The 10-13→10-20 "PARKED-UNANSWERED, act only if the operator raises it" stance on follow-ups was superseded by the 10-31 [filing policy](../orchestrator/filing-verified-issues-policy.md): verified, deduped shader-slang bugs are filed without asking.

**2026-11-05 11:3xZ, operator asked to triage #14186 (dashboard msg 36). Verdict given, no dispatch.** I re-ran the repro on a local Release
build (11-02 22:24Z; since then master has no commits that touch these types). All 3 matrix types still emit `mat2x2<>`, the scalar emits `f32((x))`, rc 0. #14186 is held: our
filing is the verdict, and jkwak-work self-assigned it 11-02 18:22Z (`assigner` = jkwak-work, Q1 2027 milestone). Root cause is the #14159 capdef alias
(`cuda_sm_8_x` → … `sm_4_1` → wgsl), not the emitter's `default: break`. No bot fixer. Offered the operator one optional bot comment on #14186
that names the shared root cause.

**2026-11-05 11:50Z, #14179 fold-in HELD.** jkwak-work self-assigned #14179 (11-02 18:13Z). The operator ask timed out, so the Hold fallback applies:
the fixer's 11-06 12:25Z one-shot is cancelled, Part 2 stays local, and #13572 stays at Part 1 head `5be2d78f1b`. The triager cancelled t-c47654. See
[14179 record](14179-wgsl-vector-negation-signed-zero.md).
