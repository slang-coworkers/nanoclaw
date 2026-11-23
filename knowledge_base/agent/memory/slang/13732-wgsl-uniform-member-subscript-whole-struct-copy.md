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
force-push = pure rebase onto 9a4817c881, same patch-id as ae4db91cd7) → caf4c9c96 (11-19 force-push,
re-verified 11-22: pure rebase onto 56dd72555 over the source-reorg, content identical):

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
  (follow-up, edited in place at each verify; newest, names caf4c9c96 after the 11-22 PATCH).

**State (last verified 2026-11-22 15:39Z):** PR #13734 OPEN, head `caf4c9c964177d784e0d7b8dc3ee91466f07088c`,
re-verified clean at the new head (pure rebase, all claims re-hold; see history file). `mergeable_state`
behind (was dirty; rework resolved the conflicts). jkwak-work still the requested reviewer; no human
maintainer review or comment; issue #13732 OPEN, assigned jkwak-work.
**Parked on maintainer review; watch-only until merge or another head move; weekly dashboard rows — next
11-26 (one-shot already scheduled, that fire sends the row).**

**Side finding, unfiled, operator call:** on master, struct `storeCoherent<16, MemoryScope::Device>`
through a `Big*` splits into member `OpStore`s with only `Aligned` — the coherent flags are lost (a
scalar store keeps them). Pre-existing, unrelated to #13734. Probe: `scratch-13732/store-coh2.slang` in the
triager's workspace. Asked the operator twice (10-29 seq 65, 11-05 seq 511348), no answer — do not ask
again, leave it to the operator.

Dated re-chase readings and decision rows live in [[13732-history-rechases.md]] — new dated entries go
there, never here.

## Re-check 2026-11-22 15:00Z — case 3: head moved (triager dispatched)

- PR #13734 OPEN, head moved cb4ad5253a → `caf4c9c964177d784e0d7b8dc3ee91466f07088c`: albertrodriguezclo force-pushed 11-19 15:06:48Z (8 reworked commits at 14:38Z; per commit messages: partial member loads reworked to load each member once and keep attributed/guarded loads whole; SPIR-V logical-copy store no longer takes the source load's attributes; new tests). The force-push landed 6 min after the 11-19 fire's live check, so the 11-19 "nothing changed" baseline missed it.
- mergeable_state now `behind` (was `dirty` — conflicts resolved by the rework). jkwak-work still the only requested reviewer; no human review; no comments/timeline activity since the force-push.
- Issue comment 6278114155 still names cb4ad5253a (updated_at 10-29 15:22:35Z).
- Action: dispatched slang-triager (pinned sess-1792248984408-me86v2, thread gh-issue-shader-slang/slang-13732, in_reply_to = task row seq 2, message id 27) to re-verify head caf4c9c96 and edit 6278114155 in place. No dashboard row this fire (off weekly cadence; next row 11-26).
- Side finding (master storeCoherent split-member OpStores, probe scratch-13732/store-coh2.slang): still no operator answer as of 11-22 15:00Z (dashboard sess-1776713576150-9fon2n rows 11-18 22:17→11-22 14:54 checked; only our own 11-19 row mentions 13732). Not re-asked.
- Successor one-shot scheduled for 2026-11-26 15:00Z (that fire sends the weekly dashboard row).
- Result (triager msg 66, 15:40Z): re-verify clean at caf4c9c96; comment 6278114155 PATCHed 15:39:41Z to name the new head; watch-only. Detail in [[13732-history-rechases.md]].
