---
type: chain
title: slang#13643 — WGSL address-space specialization re-clones its own specializations
description: "albertrodriguezclo, human-filed WGSL code-size bug: specializeAddressSpace keys its cache on the call's current callee, so a caller revisited once per call site re-clones an existing specialization (N identical Span_load copies). Reporter supplies a repro + candidate diff. Triaged 10-15 15:30Z P2; reporter PR #13648 is the fix (watch-only)."
---

# slang#13643

**2026-10-15 13:55Z, webhook `issue_opened`.** Read live before dispatching: OPEN, 0 comments, no
labels, no assignee, human-filed by albertrodriguezclo (who also filed the #13631–#13642 batch),
`updated_at` = `created_at`. The only session on `gh-issue-shader-slang/slang-13643` was this Main
webhook session. No task or `conversations/` hit, and `gh search` found no duplicate. Related:
open PR **#13151** (jvepsalainen-nv, "Reset address-space fixpoint worklist each round", the same
file, not draft, no review decision, last updated 10-09). It is a split-out of the closed #12492. The
reporter says #13151 doesn't affect this case. Also related: #13164 (closed), the same pass.

The Orchestrator spot-checked the reporter's pointer at master 6597ec9202
(`slang-ir-specialize-address-space.cpp`). `workList` is a `List<IRFunc*>` (:56). The no-specializable-arg
branch calls `workList.add(callee)` once per call site (:288). The cache key is
`FuncSpecializationKey(callee, argAddrSpaces)` on the call's *current* callee (:294), and `specializeFunc`
records `functionSpecializations[key]` with no origin (:136). A revisited caller whose call already
points at a clone misses the cache and clones again. Unverified: why SPIR-V/HLSL/Metal keep one copy.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13643`.

Mis-send: the mid-turn progress note went to `orchestrator`, which is my own group. It landed as an
outbound row in this session (seq 7) and minted no new session. No harm done, but don't repeat it.

**13:59Z, triager progress (msg 20):** reproducing on master WGSL/SPIR-V/HLSL/Metal; reading the pass + PR #13151. Not a completion report.

**15:30Z, [Triage] (msg 22, memo `/workspace/inbox/a2a-1792078246957-i7j5g6/triage-13643.md`):** bug /
low-medium / P2, IR (shared pass, not WGSL-only: Metal shows 3 copies with a local `this`, SPIR-V 3 at `-O0`, default
`-O` hidden by spirv-opt DFE). The cause is the cache key on the current callee, confirmed by an instrumented build (20 visits, 7 clones).
A worklist dedup alone is **not** enough (nested callee still 2 copies, because of `processFunction`'s `while(changed)` loop). The
principled fix is an origin-keyed cache. #13151 is orthogonal: it changes nothing on its own, and merges clean with #13648.
⚠ bot PR **#12563** (fixes #12498, CHANGES_REQUESTED, stale 09-18) textually conflicts with both and keys its cache on `callee` too.
If it resumes, it should key on its `specializationRootOf` (one map). Labels verified live: `reproduced`, Type=Bug,
assignee jkwak-work (auto).

**Fix = reporter PR #13648** (albertrodriguezclo, opened 14:04Z, non-draft, `Fixes #13643`, head `28f3cd4260`,
+`specializationOrigin` map + `tests/wgsl/address-space-specialization-dedup.slang`). The triager built it: its new test fails on
master and passes on the PR, and the PR passes 836/836 in wgsl/metal/pointer/spirv. No fixer was dispatched and no bot PR opened. The issue post was
suppressed (the PR carries the trail); the triager's draft 5-bullet is held pending GO-issue / GO-PR. Checked live at 15:3xZ: the main `CI`, format, REUSE
and label workflows are `action_required` (fork approval), and only review/SlangPy/CLA/CodeRabbit have run. Side note: recursion
under `-disable-non-essential-validations` hangs on master, and is an ICE on WGSL/Metal with #13648. It's invalid input, #12563's area, unfiled.

Re-check one-shot `recheck-13643-pr13648-bed3` 10-22 15:30Z.
**Resumes on:** #13648 merge/close/review, a human comment, or the re-check.
