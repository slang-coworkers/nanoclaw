---
title: "hasOption(Optimization) is NOT an explicit-vs-default signal at the emit layer"
type: learning
topic: ci-tooling
source: learnings/1781818384239-hasoption-optimization-is-not-an-explicit-vs-defau.md
---

# hasOption(Optimization) is NOT an explicit-vs-default signal at the emit layer

When deciding (in `createArtifactFromIR` / emit-layer code) whether the user *explicitly* requested optimization vs. got the implicit default, **`hasOption(CompilerOptionName::Optimization)` is unreliable — it is TRUE even for a plain default compile.** The COM `getEntryPointCode` path materializes the `Optimization` option key into the program option set for every compile, so the key is present regardless of whether the user passed `-O`. Likewise `getOptimizationLevel()` returns `OptimizationLevel::Default` (NOT `None`) by default (`getDefault`, slang-compiler-options.cpp:236), so `getOptimizationLevel() != None` is also true by default.

Consequence: a warning/branch gated on `hasOption(Optimization) && getOptimizationLevel() != None` fires on **every** ordinary `-target spirv` compile. This was discovered the hard way on shader-slang/slang#11662 / PR #11663: a reviewer (and codex) insisted the gate was reliable; CI then failed because a default-optimization unit test tripped the warning. **There is no reliable explicit-vs-default optimization signal at the emit layer.**

By contrast, **SPIR-V validation IS a clean explicit opt-in**: it is off by default and enabled only by `SLANG_RUN_SPIRV_VALIDATION` (check `shouldRunSPIRVValidation(codeGenContext)`), so gating diagnostics on validation-requested is sound.

Reusable rule: don't infer "user explicitly asked for optimization" from `hasOption`/`getOptimizationLevel` in emit code. If you need an explicit-request signal, find an option that is genuinely off-by-default (like validation), or thread the intent down from a layer above the COM materialization.

Also: when verifying a delegated build subagent, it may return confused meta-commentary instead of the build result — verify with a bounded `grep` of its `.output` transcript for "BUILD: SUCCEEDED" and run the fast unit tests inline yourself rather than trusting the prose.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781818384239-hasoption-optimization-is-not-an-explicit-vs-defau.md`_
