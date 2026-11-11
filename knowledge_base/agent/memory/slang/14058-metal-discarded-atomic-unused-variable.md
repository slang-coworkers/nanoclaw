---
type: chain
title: slang#14058 — Metal discarded atomic results → -Wunused-variable temporaries
description: "Human bug (albertrodriguezclo, CONTRIBUTOR, cloth-sim batch), P2, widened to all discarded non-void calls. Draft PR #14209 (R1 APPROVE_WITH_NITS applied). 11-10: master merged at e6a5574e1, so the PR is MERGEABLE again; reporter answered; pr-mapping re-claimed by uy6784. Ready-flip pending on the weekly list. Owns filed-only #14216. No timer."
tags: [slang, metal, emit, atomics, unused-variable, chain]
---

# slang#14058: discarded atomic results produce `-Wunused-variable` in Metal output

Reporter **albertrodriguezclo** (CONTRIBUTOR, the same cloth-sim port batch as #14027/#14029/#14031–#14037). Filed
2026-10-29T21:51:33Z. `InterlockedAdd(p[i], 1u)` and `Atomic<T>::add(...)` with the result discarded emit
`uint _S2 = atomic_fetch_add_explicit(...)` on Metal. `xcrun metal` warns once per call site, which breaks `-Werror` builds.
The dated history (routing, triage, rescope, PR, re-chases, SHAs, comment ids, test counts) is in
[[slang/14058-history-triage-to-merge-master.md]]. **Add new dated entries there.**

## Current state (11-10 16:15Z, Main-verified)

| | |
|---|---|
| Issue | #14058 OPEN, `reproduced`, Type=Bug; thread `gh-issue-shader-slang/slang-14058` |
| PR | **#14209** draft, `fix/issue-14058` @ `e6a5574e1` (merge commit of 8d9dd07cc + master 4f66408b3). MERGEABLE; BLOCKED only by draft status and the pending review. Assignee and requested reviewer: jkwak-work |
| Review | slang-reviewer R1 APPROVE_WITH_NITS (0 bugs), nits applied. G3 open: the metallib `-Xmetal -Werror` lanes have never run (macOS; they need the ready-flip) |
| CI | run 42851886083 at the priority-yield gate |
| Sessions | triager `sess-1793310892825-g1df5o`; fixer chain `sess-1793311978024-uy6784` (owns the pr-mapping since 11-10 16:12:53Z) |
| Ready-flip | pending on the operator's [weekly list](../orchestrator/undraft-asks-replaced-by-weekly-list.md). Do not send per-PR asks (P2, not a regression) |
| Timer | none. Webhooks and the triager's 5-bullet drive the chain |

**Resume on:** the operator's weekly-list answer or a maintainer's ready-flip; jkwak-work's review; the reporter's offered
`metal -Werror` run on the 41 files (a live inbound to `uy6784` through the mapping).

## Design (fixer's implementation, reviewer-approved)

- **Root cause is emit, not lowering** (triager, 10-29). The discarded results have 0 uses in the IR that reaches emit,
  and `shouldFoldInstIntoUseSites` correctly leaves them alone. Metal's atomic lambda in `tryEmitInstStmtImpl`
  (slang-emit-metal.cpp:424-453) called `emitInstResultDecl` unconditionally. HLSL/GLSL/CUDA also bind the temp, but
  only Metal's default warnings flag it.
- **Fix:** a new `hasNonDebugUse` (slang-ir-util.h). When an atomic RMW/Load/Inc/Dec/CAS has no non-debug use, Metal
  emits a bare call (no temp, no texture `.x`, no CAS decl/copy). `tryEmitDiscardedCallStmt` is called only from
  `_emitInst`'s default branch. For a 0-use IRCall it emits a bare `f(...);` for user callees, and `(void)(…);` for
  target intrinsics on Metal/C/C++/CUDA. HLSL/GLSL keep the binding, because a bare pure intrinsic draws DXC's default-on
  -Wunused-value. **WGSL is unchanged**: `@must_use` builtins would hard-error. `(void)e` lowers to a dropped CastToVoid,
  so it is the same 0-use IRCall.
- **Rejected:** C, a generic skip in `emitInstResultDecl` (it breaks WGSL and SwizzleSet/UpdateElement). D,
  `[[maybe_unused]]`/`(void)` everywhere (it masks the symptom).
- **Out of scope:** non-call side-effecting insts with 0 uses (Div/IRem, ImageLoad, StructuredBufferConsume, wave ops).
- **Revert drill:** `hasUses()` in place of `hasNonDebugUse` fails only the `-g` runs.
- **Tests:** `tests/metal/atomic-unused-result.slang` and `tests/metal/unused-call-result.slang`.

## Linked work

- **Overlaps:** [#14031](../imported/project_14031_metal_64bit_atomics_atomic_ulong.md) / draft #14044 (`emitAtomicCall`
  with `returnsValue`) and open #14170 touch the same Metal atomic emit. The PR's Risk line names both; the second
  to merge resolves a few lines. #14210 (Metal float atomics) merged 11-05 and was resolved in the 11-10 merge.
- **Owns filed-only #14216** (side find S1, from the reviewer). Under `-g`, a value used only by `DebugValue` survives
  DCE and is emitted as an unread local on all six C-like targets, because `stripDebugInfo` runs only at `-g0`
  (slang-emit.cpp:1096-1101). jkwak-work self-assigned it (`DebugInfo`, Q1 2027). ⚠️ Do not dispatch its webhooks; a human
  comment goes to the triager as a live inbound.
- The [#13771 record](../imported/project_13771_metal_rwtexture_fence.md) saw the same warning on an atomic result.

## Lessons

- **A pr-mapping on a `system:tasks:*` one-shot session dies when the task ends.** #14209 first mapped to `fejlik`,
  the fixer's resume task session. Once it closed, reporter comment 6697870033 went unanswered for 4 days. In every
  re-chase, check `ncl sessions get <mapped sid>`. The live owner's later `report_pr_created` re-claimed the mapping,
  so no remap was needed. This general rule is item 19 of [[orchestrator/supervise-tick-blind-spots-session-stalls.md]].
