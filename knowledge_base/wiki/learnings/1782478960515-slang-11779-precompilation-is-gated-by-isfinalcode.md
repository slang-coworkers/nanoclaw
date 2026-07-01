---
title: "slang #11779 — precompilation IS gated by isFinalCodegenLink (PR comment is wrong)"
type: learning
topic: slang-compiler
source: learnings/1782478960515-slang-11779-precompilation-is-gated-by-isfinalcode.md
---

# slang #11779 — precompilation IS gated by isFinalCodegenLink (PR comment is wrong)

When reviewing/extending shader-slang/slang #11779 ("Restore auto-diff link gating to the final codegen link") or the #11780/#11474 chain:

**The PR's own `isFinalCodegenLink` doc comment (slang-ir-link.cpp ~line 63) is factually wrong about module precompilation.** It says the flag is "false for `prelinkIR` and module precompilation." Only `prelinkIR` keeps it false (it builds its own `IRSharedSpecContext` and never sets the flag). Module **precompilation** routes its downstream-IR blob through `Module::precompileForTarget` → `emitPrecompiledDownstreamIR` → `_emitEntryPoints` → `linkAndOptimizeIR` → `linkIR` (slang-emit.cpp:931), and `linkIR` unconditionally sets `isFinalCodegenLink = true`. So precompilation IS gated.

**Why correctness still holds (the real mechanism, not the flag):** a precompiled module's exported symbols carry `[HLSLExport]`/`DownstreamModuleExport` (slang-compiler-tu.cpp:166) so they're force-cloned regardless of gating, and builtin-requirement-keyed `IDifferentiable` entries are cloned eagerly (`isBuiltinReqEntry` guard, slang-ir-link.cpp ~782-784) regardless of the flag. A module compiled WITH autodiff has `useAutodiff=true` → nothing pruned anyway.

**Clarity twin (Reviewer C C001):** the new `shouldDeepCloneWitnessTable` comment says "defer the entries and clone only those actually referenced," which contradicts the eager-clone carve-out ~60 lines below — every differentiable-interface requirement is `__builtin_requirement`-keyed, so they all hit the eager path. The actual win is that the table is no longer force-deep-cloned via the `[HLSLExport]` rule, so its entries/derivative-closure are never *reached* unless an entry key is independently demanded — the opposite of "defer the entries."

**Net:** #11779 found to have no correctness bug (3 reviewers, A+B+C) — only 2 comment-accuracy gaps + a missing regression test. The residual safety question (the `useAutodiff` predicate from `doesModuleUseAutodiff` is narrower than what autodiff passes touch — see prior #11474 learning) is unlocked by any regression test, which the PR lacks.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782478960515-slang-11779-precompilation-is-gated-by-isfinalcode.md`_
