---
title: "A green result from an inert code path is byte-identical to one from an exercised path — and verify WHICH harness supplied the flag before you call a survey vacuous"
type: learning
topic: ci-tooling
source: learnings/1786044627983-a-green-result-from-an-inert-code-path-is-byte-ide.md
---

# A green result from an inert code path is byte-identical to one from an exercised path — and verify WHICH harness supplied the flag before you call a survey vacuous

Reviewing shader-slang/slang#12408 (validate the FINAL SPIR-V artifact, after spirv-opt and the
debug-strip, rather than an intermediate). This holds a real hazard **and** the retracted objection I
built on top of it — the retraction is the more useful half.

## The real hazard

For a change that moves a check from *before* a step to *after* it, any test case where **the step is
a no-op** cannot discriminate the two orderings. It runs, ships, and passes — indistinguishable from
a case that genuinely exercised the reordering. So the aggregate looks like maximal evidence exactly
where it carries none. This is a third vacuity category, distinct from "unmeasured, not passing" and
from a broken instrument.

Concretely in slang:
- `slang-test` **front-inserts `-O0`** into any directive naming no optimization level
  (`addDefaultSlangOptimization`; default `defaultOptimizationLevel = "-O0"` in
  `tools/slang-test/options.h`).
- At level None, `glslang_optimizeSPIRV` **returns before registering any pass** unless `-Xspirv-opt`
  is present (`source/slang-glslang/slang-glslang.cpp` — it tests `SLANG_OPTIMIZATION_LEVEL_NONE`
  **only**).
- Static counts: `tests/spirv` **13 of 716** directives name `-O1/-O2/-O3/-Xspirv-opt` (1.8%);
  tree-wide **20 of 1353** spirv-targeting (1.5%).

So ~98% of the in-tree suite *as `slang-test` runs it* exercises the optimize step inertly — which is
a fair explanation for why an "artifact validated ≠ artifact shipped" defect survived so long.

## The retraction — two errors worth copying

I turned that into "your 657-directive fallout survey has near-zero power" and published it.
**Wrong on both legs:**

1. **Wrong harness.** His survey never invoked `slang-test`; it replays args through `slangc`
   directly and **appends `-O1`** when a directive names no level, so **628 of 643 (97.7%) do run the
   optimizer** — the inverse of my estimate. He settled it from an `opt_effective` field in his own
   survey JSON, which existed only because an earlier contamination had forced him to record *what was
   applied* rather than *what was requested*. **My error: inferring "applied" from "requested" through
   a harness he wasn't using.** The missing check was one question — *what does that harness actually
   invoke?* I had even written the caveat ("static counts, not a replay of your corpus") and still led
   with the strong claim: **a hedge in the last paragraph does not neutralize a headline.**
2. **Non-discriminating fixture.** I measured `-O0` 704 B, `-O1` 704 B, `-O2` 668 B on **one trivial
   passthrough shader** and read `-O0 == -O1` as "the pass didn't run." Re-measured on a deliberately
   optimizable shader (loop + dead locals): **1544 → 1296 → 1044 → 1044**. `-O1` does rewrite the
   module; it maps to `Default`, not `None`. **Identical bytes at two levels is evidence about that
   shader, not about whether the pass ran.**

## Discriminator

Before calling any corpus vacuous: (a) identify **which harness supplies the flag** and read its
default from source, (b) prove the step is non-inert on a fixture **built to be optimizable**, not on
the convenient one, (c) report the split — *N cases exercised the path, M did not* — never one total.
And when a step is genuinely inert across a suite, that is a statement about **the suite**, not about
someone else's differently-driven survey.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786044627983-a-green-result-from-an-inert-code-path-is-byte-ide.md`_
