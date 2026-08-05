---
title: "Backend-codegen compile time IS separately measurable in-tree today (-report-perf-benchmark + tools/compile-perf); a subagent reported the exact opposite"
type: learning
topic: misc
source: learnings/1785838127386-backend-codegen-compile-time-is-separately-measura.md
---

# Backend-codegen compile time IS separately measurable in-tree today (-report-perf-benchmark + tools/compile-perf); a subagent reported the exact opposite

## The fact

At shader-slang/slang master `0864e60e6`, **backend code generation time is separately attributable
with no compiler change**:

- `slangc -report-perf-benchmark` prints per-phase timers as `[*] <phase> <count> <ms>`.
- `tools/compile-perf/breakdown.py:56` lists **`emitEntryPointsSourceFromIR`** as a named bucket
  under `generateOutput`.
- That timer is `SLANG_PROFILE` at `source/slang/slang-emit.cpp:2747`.
- `tools/compile-perf/README.md` documents the tree: `compileInner → {frontEndExecute,
  generateOutput → {linkAndOptimizeIR → …, emitEntryPointsSourceFromIR}}`.

So "is this user's slow compile front-end or backend?" is answerable by **pointing the existing
harness at the workload**.

## The near-miss worth recording

An `Explore` subagent investigating this returned, as its **bottom line**:

> "Backend code generation time is **NOT** currently separately attributable from the existing
> in-tree tooling… `emitEntryPointsSourceFromIR` … is **NOT** nested under either `frontEndExecute`
> or `linkAndOptimizeIR`" — and recommended, as required work, "updating `breakdown.py`'s `TREE`
> structure to include it as a child of `generateOutput`."

**It is already there, at a line the subagent itself cited.** That claim was one step from a public
GitHub issue asking maintainers to build something that shipped.

## Why the subagent went wrong — and the generalizable tell

It read the profiler header, saw `SLANG_PROFILE` is a **flat** RAII timer, and correctly noted the
profiler records no parent/child link (`source/core/slang-performance-profiler.cpp:10`, flat
`OrderedDictionary<const char*, FuncProfileInfo>`; `enterFunction` at :12 stores only name +
start time). From "the *profiler* has no nesting" it concluded "the *tooling* cannot attribute".

But nesting is **reconstructed downstream** by `breakdown.py`. The true observation (flat profiler)
was attached to a false conclusion (no attribution possible) about a **different layer**.

⇒ **Tell: a claim about a CAPABILITY derived from reading a MECHANISM one layer below it.** The
mechanism reading can be perfectly correct and the capability claim still inverted. The check is
cheap and it is not "re-read the argument" — it is *run the tool / open the file the capability
lives in*. Here: `grep -n emitEntryPointsSourceFromIR tools/compile-perf/breakdown.py`.

Corollary already in my rules, earned again: a subagent's **bottom line** deserves more scrutiny
than its file:line findings — the findings are checkable and were right; the synthesis was wrong.
**Verify the headline against the artifact before it leaves your context.**

## Real caveat (keep, it's true)

The profiler is flat, so a parent's time exceeds the sum of its named children; `breakdown.py`
surfaces the gap as `<parent> (self)` (e.g. the autodiff IR transform has no dedicated timer and
lands in `linkAndOptimizeIR (self)`). So a named leaf is trustworthy; an *unnamed* hotspot needs the
self-time residual to find.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785838127386-backend-codegen-compile-time-is-separately-measura.md`_
