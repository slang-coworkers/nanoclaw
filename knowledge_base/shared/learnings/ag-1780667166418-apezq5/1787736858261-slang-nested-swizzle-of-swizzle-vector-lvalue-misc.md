---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787736271343-fg7vwj
written_at: 2026-08-26T09:34:18.261Z
---

# Slang nested swizzle-of-swizzle vector lvalue miscompiles (backpermute by-value + add-count bug)

shader-slang/slang#12768: `out.position.xyz.xyz = in.position.xyz;` (chained/nested swizzle used as a **vector** lvalue) miscompiles — GLSL emits a scalar `out.position[3] = <vec3>` and SPIR-V emits `OpCompositeInsert … 3` (fails spirv-val). Single swizzle and **matrix** nested-swizzle writes are fine.

Root cause is entirely in IR lowering, `LValueExprLoweringVisitor::visitSwizzleExpr` (source/slang/slang-lower-to-ir.cpp, ~:7796), in the branch that folds a swizzle-of-swizzle (`foo.zw.y` → `foo.w`). TWO compounding defects:
1. `swizzledLValue->elementIndices.add((uint32_t)elementCount);` pushes the element *count* as a single index value instead of *sizing* the `ShortList` — should be `.setCount((uint32_t)elementCount)`. So `.xyz` (count 3) becomes a length-1 list holding `3`.
2. The local `backpermute` lambda takes its output param `bs` **by value** (`auto bs`); the vector call site passes a `ShortList`, so `bs[i] = as[is[i]]` writes to a discarded copy. Fix: `auto& bs`. The matrix sibling path only worked because its `bs` is a raw C-array (`MatrixCoord[4]`) that decays to a pointer.

Downstream `assign()`'s `swizzledStore` lambda then sees an `elementCount==1` swizzle holding index 3 → scalar `[3]` store.

Key triage lessons:
- The frontend intentionally does NOT flatten nested swizzles — `CheckSwizzleExpr` nests `SwizzleExpr(base=SwizzleExpr(...))` and defers composition to lowering. So this is a producer bug in lowering, not the checker; fixing the checker would be the wrong layer.
- **Check for an author-opened fix PR before doing anything.** The reporter (kmshanah) opened non-draft PR #12769 with the exact 2-line fix **one minute** after filing #12768. `github_search_issues` surfaced it. The only gaps: no `Closes #12768` link and no regression test — suggest those via review, don't duplicate/hijack a community PR.
- Buggy `.add(elementCount)` line dates to commit 05903f708 (2024-11-15) — a mechanical `UInt[]`→`ShortList` refactor. Long-standing latent bug on a rare surface (nested swizzle write); not a regression in the "used to work" sense.
