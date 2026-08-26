---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787256010142-zhim7o
written_at: 2026-08-25T16:08:56.717Z
---

# [approver/challenger-calibration] A more-principled root-cause rewrite can still ABSTAIN — probe the type-FAMILY (fix one sibling, leave the other)

**Context:** slang#12665 R3 (`ed32678`). Across 3 revisions the author moved from a downstream band-aid to a root-cause fix. R1/R2 added `case kIROp_CopyLogical` to `legalizeInst` (recognized an empty copy artifact); R3 **removed** that (-8 lines) and instead added `kIROp_CoopVectorType` to `isValueType()` in `slang-ir-util.cpp` (+3), so autodiff DCE drops the dead read-none rematerialization call at its source and the empty-copy shape never forms. Devin + source confirm this is the *more principled* fix (fix the producer, not the consumer — the repo's stated methodology). Yet R3 = ABSTAIN_POLICY (OPEN_GAP), not WOULD_APPROVE.

**Why it still abstains — the CLASS-PREDICATE EDGE:** the fix widens a type-classification predicate for ONE member of a two-member type family. `getVectorElementType` (`slang-ir-util.cpp:44`) handles `IRCoopVectorType` and `IRCoopMatrixType` **identically** (both `->getElementType()`) — they are the same class of first-class numeric value. But only `CoopVectorType` was added to `isValueType`'s value list; `CoopMatrixType` falls to `default`→`false`. So an analogous autodiff/resource-context shape built over CoopMatrix would NOT get the DCE and could still hit the original ICE. The bug *class* is only half-fixed.

**How to catch it (transferable probe):** When a fix works by adding a type/op to a classification set (`isValueType`, `isX`, a switch of `kIROp_*` cases), don't just verify the added member is correct — **grep the codebase for a SIBLING op handled identically elsewhere and check whether it was added too.** The tell: a helper like `getVectorElementType`/`getXOrYElementType` that lists `A` and `B` in the same `if`-chain, but the PR only adds `A` to the target predicate. If `B` reaches the same failure path, that's an OPEN_GAP (partial fix of the bug class), not a nit — the PR's stated purpose (fix the ICE class) is only partially met.

**Two more R3 signals reinforcing the abstain (both independent of the code):**
1. My R2 CI-coverage gap PERSISTED: all 3 regression tests still `//TEST(compute, vulkan): -vk` GPU-gated, skipped on GPU-free CI, though the fix is compile-time (sibling `coopvec.slang`/`coopvec-subscript.slang` carry `-cpu` variants that run). Author added tests but kept all GPU-gated ⇒ my R2 predicted-clear path was not taken. A prior revision's open gap does NOT auto-clear because the code approach changed — re-verify it at the new head.
2. An explicit OPEN maintainer request (kaizhangNV: "add a simpler test case … this one is a little bit complicated") — a live human signal the PR isn't merge-ready, independent of the bot verdict.

**Rule:** "more principled approach" and "code is correct" do NOT imply WOULD_APPROVE. The decision is about the current head's completeness + testability, not the elegance of the fix. A root-cause rewrite that fixes one sibling of a type family, ships GPU-only tests for a compile-time fix, and has an open maintainer request is an ABSTAIN(OPEN_GAP) — route to the human, don't reward the better design with an approve it hasn't earned on coverage.
