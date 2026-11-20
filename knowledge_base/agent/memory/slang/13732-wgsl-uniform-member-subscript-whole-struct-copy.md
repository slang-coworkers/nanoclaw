---
type: chain
title: slang#13732 — WGSL whole-uniform-struct copy for a member subscript call
description: Human-filed WGSL perf regression; fix = the reporter's own PR #13734 (no fixer chain). PARKED on maintainer review; dated readings in [[13732-history-rechases.md]]
---

# slang#13732 — WGSL: member subscript on a uniform struct copies the whole struct

**Issue:** human-filed by albertrodriguezclo 2026-10-17 (same reporter as #13631–#13690). On WGSL, `push.b[i]`
(a `__subscript` getter on member `b` of `uniform Push push`) emits a whole-struct copy
(`var _S3 : Push_std140_0 = globalParams_0.push_0;` then `&(_S3.b_0)`) instead of a member-only load.
Triage verdict (10-17): regression (codegen quality, no wrong results), P2, IR buffer-element lowering →
WGSL + SPIR-V -O0. Regression since v2025.19; first bad e420f2f98 (#8668, "Defer `IRCastStorageToLogicalDeref`
in lowerBufferElementType pass"). Mechanism: the `deferBufferLoad` size gate (>16 B and (>128 B or has array),
`slang-ir-defer-buffer-load.cpp:59-92`) hides the copy for large members; otherwise the `kIROp_Load` case of
`lowerBufferElementTypeToStorageType` copies the whole value and passes `&tmp.b`. Related: #13703
(large `in` struct params on WGSL, `awaiting_human`).

**Fix:** the reporter's own **PR #13734** (human PR — no fixer chain; review events route as a human PR,
approvers paused). Verified by slang-triager across heads 28bf262e96 → ae4db91cd7 → cb4ad5253a (10-27
force-push = pure rebase onto 9a4817c881, same patch-id as ae4db91cd7):

- Fixes the repro and its 12 variants; member-only loads only. Attributed loads kept whole via the
  `deferBufferLoad` rule (`slang-ir-lower-buffer-element-type.cpp:1268-1272`) + shared `hasWholeAccessAttr`
  (slang-ir-util) — revert drills: 1/3 vs 3/3 without/with the guard; `hasWholeAccessAttr(load)` :1309 →
  1/5 disabled, 5/5 restored. `guardedConstantIndex` + cross-block gate (:1323-1328) covered by the
  GUARD case; the literal in-bounds check is untestable (front end rejects it first, E30029).
- 15d5ec38b ("a logical copy's store does not take the source load's attributes", 22-line SPIR-V emitter
  change) is principled — `IRCopyLogical` attributes only come from the source load (slang-ir.cpp:5688) —
  and fixes a genuine pre-existing master bug (master 01dcd3568 stores the coherent copy with
  `MakePointerAvailable|NonPrivatePointer` into a Function var; spirv-val rejects it). Its test catches the
  bug only through spirv-val (revert drill 3/5 with validation, 5/5 without).
- Subsets passing at last verify: 1324/1324 on the PR, 1350/1350 on master.
- Bot comments on the issue: [6236090926](https://github.com/shader-slang/slang/issues/13732#issuecomment-6236090926)
  (triage; labels `regression`+`reproduced`, Type=Bug) and
  [6278114155](https://github.com/shader-slang/slang/issues/13732#issuecomment-6278114155)
  (follow-up, edited in place at each verify; newest, names cb4ad5253a).

**State (last verified 2026-11-19 15:00Z):** PR #13734 OPEN, not merged, head unchanged cb4ad5253a;
`mergeable_state` now **dirty** (merge conflicts with master; was BEHIND at 11-08). jkwak-work still the
requested reviewer; no human maintainer review or comment; issue/PR comments and timeline silent since
10-30; issue #13732 OPEN, assigned jkwak-work; comment 6278114155 still names cb4ad5253a. 21-day dashboard
row sent 11-19 (thread gh-issue-shader-slang/slang-13732).
**Parked on maintainer review; next re-check: one-shot ~11-22 (no dashboard row unless changed); weekly
rows only - next 11-26, then 12-03.**

**Side finding, unfiled, operator call:** on master, struct `storeCoherent<16, MemoryScope::Device>`
through a `Big*` splits into member `OpStore`s with only `Aligned` — the coherent flags are lost (a
scalar store keeps them). Pre-existing, unrelated to #13734. Probe: `scratch-13732/store-coh2.slang` in the
triager's workspace. Asked the operator twice (10-29 seq 65, 11-05 seq 511348), no answer — do not ask
again, leave it to the operator.

Dated re-chase readings and decision rows live in [[13732-history-rechases.md]] — new dated entries go
there, never here.
