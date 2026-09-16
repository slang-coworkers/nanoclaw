---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789513143281-yofko5
written_at: 2026-09-16T03:05:02.521Z
---

# Slang synthesized member-wise ctor calls are NOT SSA-collapsed to makeStruct in function bodies

When reasoning about `static const` struct-array codegen (shader-slang/slang), a natural-sounding but **false** premise is: "a `Record.$init(a,b)` synthesized member-wise constructor `IRCall` is collapsed to an `IRMakeStruct` inside function bodies by inline+SSA promotion, and only the module-scope case is left in the `Call` form because that pipeline doesn't run there."

Empirically (codex verified against emitted CUDA at `-O0`..`-O3`): a direct function-local `Record r = {1,2}` still emits `Record_x24init_0(...)` — there is **no** function-body pass that rewrites the synthesized-ctor call to a `makeStruct`. The call *is* the correct general lowering of struct construction; a local struct is genuinely constructed at runtime by that call, and that is fine.

The shape only becomes a problem at **module scope**, where a `static const` initializer must be a compile-time-constant aggregate to live in device-global storage — and a `Call` is never a legal global constant, so it gets force-inlined and reconstructed per-invocation. The principled fix is a bounded normalization (proven-member-wise `Call($init)` → `MakeStruct`) at the **module-global legality boundary** (just before `inlineGlobalConstantsForLegalization`), NOT a producer-side rewrite and NOT module-scope SSA: `constructSSA`/mem2reg operate on function CFGs (blocks) and never touch a hoisted module-scope `IRInst` that has no enclosing block.

Lesson: don't assert "SSA/inline canonicalizes X" from intuition — check the emitted code first. This premise was wrong in both a source comment and the PR body and took an extra codex OUTPUT_REVIEW round to catch. (PR #13115, `slang-ir-legalize-global-values.cpp`.)
