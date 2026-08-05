---
title: "A fallback that coincides with the correct answer makes tests inert — enumerate what must differ, not just what must exist"
type: learning
topic: ci-tooling
source: learnings/1785826158533-a-fallback-that-coincides-with-the-correct-answer-.md
---

# A fallback that coincides with the correct answer makes tests inert — enumerate what must differ, not just what must exist

## The setup

A feature resolves X to its correct owner. When resolution fails, emission falls back to a default. In shader-slang/slang, a SPIR-V `DebugFunction` is scoped to its owning `DebugCompilationUnit`; when the lookup misses, the module-global fallback is **pinned to the entry point's CU** (PR #10907).

So any test where *the correct answer happens to equal the entry point's CU* passes whether the feature works or not.

## The trap I predicted, and the one that actually got me

I predicted the shallow version: a single-CU test is vacuous, because with one CU the fallback trivially equals the right answer. Correct — and I built a two-CU fixture to escape it.

**Two CUs was necessary but not sufficient.** In my two-CU fixture, the entry point `main` lived in the *same file that did the `#include`*. So the includer's CU **was** the entry-point CU, and the fallback coincided again. The test passed on pristine master, before any fix. I had labeled it "the discriminating test" and would have shipped it as proof of a fix it could not see.

The genuinely decisive configuration needed a third condition I hadn't enumerated:

```
fileA.slang   [shader(...)] main            -> CU_A   (entry point here)
fileB.slang   #include "helper.slang"       -> CU_B   (the includer)
helper.slang  the function under test       -> no CU
```
Now `includer-CU (CU_B) != entry-CU (CU_A)`, so fallback and correct answer finally differ. On pristine master the included function got **CU_A** — the bug, visible at last.

## The rule

Don't ask "does my test contain the ingredients" (two CUs, an include, a multi-file build). Ask: **in this exact configuration, does the fallback produce a different value from the fix?** Then enumerate every condition that must *differ* — not merely exist — and check each. Existence is easy to eyeball and easy to get wrong; difference is what carries the information.

Practically: name the fallback's value explicitly (here: "the entry point's CU"), name the expected value ("the includer's CU"), and construct the case where those two are provably distinct insts. If you cannot articulate why they differ in your fixture, the fixture is inert.

## Corollaries

- **"Validated against a prototype" is not evidence of discriminating power.** These fixtures had that provenance; they were validated in a configuration where the fallback agrees. Prior validation transfers only if the configuration transfers.
- **A pre-registered red baseline is what catches this.** Nothing else would have: the tests were green, the build was clean, the feature was broken. Had I skipped the baseline and only run tests after implementing, I'd have read the same green as success.
- **Repair, then re-establish red.** After fixing an inert test, confirm it fails *before* implementing, or the repair silently becomes the thing under test.
- Related while diagnosing: `-g2` embeds the source, so `grep DebugCompilationUnit` matches your own `//CHECK` comment lines. Anchor on `^%N = OpExtInst` to read real records ([[slang -g2 spirv-asm filecheck tests embedded source]]).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785826158533-a-fallback-that-coincides-with-the-correct-answer-.md`_
