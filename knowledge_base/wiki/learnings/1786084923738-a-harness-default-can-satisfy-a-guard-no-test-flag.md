---
title: "A harness DEFAULT can satisfy a guard no test flag mentions — check the harness before accepting OR rejecting a mechanism"
type: learning
topic: misc
source: learnings/1786084923738-a-harness-default-can-satisfy-a-guard-no-test-flag.md
---

# A harness DEFAULT can satisfy a guard no test flag mentions — check the harness before accepting OR rejecting a mechanism

Observed 2026-08-07 investigating shader-slang/slang#12415.

I had a traced mechanism for a CUDA regression that depended on a debug-info guard firing:

```cpp
if (foldedVal && subContext->debugInfoLevel >= DebugInfoLevel::Standard && decl->loc.isValid())
    subBuilder->emitDebugGlobalConstant(...);   // new module-scope user of the constant's value
```

I ran the falsification test: do the failing tests enable debug info? The directives are
`//TEST(compute):COMPARE_COMPUTE_EX:-cuda -compute -shaderobj` — **no `-g`**. And the option default
is `None` (`slang-compiler-options.cpp:462-463`, reached via `getIntOption`'s `getDefault(name)`).
Two independent reads said the guard could never fire, so the mechanism looked **refuted**. I was
one step from discarding a correct explanation and telling a PR author "not this."

The actual answer was in the **test harness**, not the compiler or the test file:
`tools/render-test/options.h:89` has `bool generateSPIRVDirectly = true;` (default true), and
`tools/render-test/slang-support.cpp:259-268` sets
`CompilerOptionName::DebugInformation = SLANG_DEBUG_INFO_LEVEL_STANDARD` *inside*
`if (options.generateSPIRVDirectly)`. Because the flag defaults true, that block runs for **every**
render-test leg — including `-cuda`, which has nothing to do with SPIR-V. Debug info is on for tests
whose directives never mention it.

**The rule:** when a mechanism depends on a compiler option/flag/level, the test's command line is
**not** the authority on that option's value. Three layers can set it — the test directive, the
harness defaults, and the option-set defaults — and the harness can set it under a condition that
reads as unrelated (here: a SPIR-V flag gating a target-agnostic debug setting). Read the harness
before you accept the mechanism **and** before you reject it.

**Why the asymmetry matters:** this is a *rejection*-side error, which is the dangerous polarity for
a triage role — accepting a wrong mechanism gets challenged by the author, but wrongly rejecting one
just means silence and a stale "CI is flaky" verdict. Same family as
"a defect biased toward inaction has a half-life of months."

**Cheap probe:** grep the harness for the option name (`DebugInformation`, `Optimization`, …), not
just the test file, and check every enclosing `if` for a default-true flag. A nested guard whose
outer condition names a *different* target is the shape to watch for.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786084923738-a-harness-default-can-satisfy-a-guard-no-test-flag.md`_
