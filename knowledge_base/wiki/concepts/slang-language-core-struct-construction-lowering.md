---
title: "Slang struct-construction lowering: synthesized member-wise ctors and module-global constant legalization"
type: concept
group: slang-language-core
tags: [slang, ir, struct-construction, makestruct, static-const, global-values, legalization, ssa]
source_count: 1
---

# Slang struct-construction lowering: synthesized member-wise ctors and module-global constant legalization

How Slang lowers struct construction (`Record{...}` / synthesized member-wise constructors) into IR, and why the shape that is correct inside a function body becomes illegal at module scope.

## TL;DR

- A synthesized member-wise ctor `Record.$init(a,b)` lowers to an `IRCall` and is **NOT** SSA/inline-collapsed to `IRMakeStruct` inside function bodies — the `Call` IS the correct general lowering of runtime struct construction. Verify emitted code; don't assume "SSA/inline canonicalizes X."
- The `Call` form only becomes a problem at **module scope**, where a `static const` initializer must be a compile-time-constant aggregate; a `Call` is never a legal global constant. Fix is a bounded normalization (proven-member-wise `Call($init)` → `MakeStruct`) at the module-global legality boundary (just before `inlineGlobalConstantsForLegalization`), NOT a producer-side rewrite and NOT module-scope SSA (`constructSSA`/mem2reg only touch function CFGs, never a block-less hoisted module-scope inst).

## Synthesized member-wise ctor calls are not SSA-collapsed to makeStruct in function bodies

When reasoning about `static const` struct-array codegen (shader-slang/slang), a natural-sounding but **false** premise is: "a `Record.$init(a,b)` synthesized member-wise constructor `IRCall` is collapsed to an `IRMakeStruct` inside function bodies by inline+SSA promotion, and only the module-scope case is left in the `Call` form because that pipeline doesn't run there." Empirically (codex verified against emitted CUDA at `-O0`..`-O3`): a direct function-local `Record r = {1,2}` still emits `Record_x24init_0(...)` — there is **no** function-body pass that rewrites the synthesized-ctor call to a `makeStruct`. The call *is* the correct general lowering of struct construction; a local struct is genuinely constructed at runtime by that call, and that is fine.

The shape only becomes a problem at **module scope**, where a `static const` initializer must be a compile-time-constant aggregate to live in device-global storage — and a `Call` is never a legal global constant, so it gets force-inlined and reconstructed per-invocation. The principled fix is a bounded normalization (proven-member-wise `Call($init)` → `MakeStruct`) at the **module-global legality boundary** (just before `inlineGlobalConstantsForLegalization`), NOT a producer-side rewrite and NOT module-scope SSA: `constructSSA`/mem2reg operate on function CFGs (blocks) and never touch a hoisted module-scope `IRInst` that has no enclosing block (PR #13115, `slang-ir-legalize-global-values.cpp`).

Lesson: don't assert "SSA/inline canonicalizes X" from intuition — check the emitted code first. This premise was wrong in both a source comment and the PR body and took an extra codex OUTPUT_REVIEW round to catch ([Slang synthesized member-wise ctor calls are NOT SSA-collapsed to makeStruct in function bodies](../learnings/1789527902521-slang-synthesized-member-wise-ctor-calls-are-not-s.md)).

**Source learnings (1):**

- [Slang synthesized member-wise ctor calls are NOT SSA-collapsed to makeStruct in function bodies](../learnings/1789527902521-slang-synthesized-member-wise-ctor-calls-are-not-s.md) — the `Call($init)` is the correct runtime lowering; the module-scope `static const` illegality is fixed by a bounded `Call($init)`→`MakeStruct` normalization at the global-constant legality boundary, not by producer rewrite or module-scope SSA.
_Catalog: [[wiki/index.md]]_
