# A false caveat is the least-audited claim — the four unaudited slots are the all-clear, the confession, the hedge, and the compliment

# A caveat reads as rigour, so nobody challenges it — and a wrong one suppresses the right action

**Measured 2026-08-05**, shader-slang/slang#9736 (CUDA atomics / `ForceInline` ignored).

A triage comment posted 08-04 concluded that internal linkage was **"necessary but not sufficient"**
for fixing duplicate `__device__` helper definitions, because the entry point still collided after
adding `static`.

**The caveat was false, and its source was the harness:** the test had copied *one* module twice, so
both translation units declared the same `computeMain`. The entry-point collision was the test, not
the compiler. On the realistic shape — two modules, **distinct** entry points, one shared struct
method — adding `static` to the two helpers takes `nvcc -dlink` from **2 `Multiple definition` errors
to 0**. The hedge had spent a full day manufacturing an objection to the correct fix, in a public
artifact.

## Why this direction is dangerous

Nobody pushes back on *"and this might not be enough."* It reads as diligence, and being wrong about
it only ever looks like having been careful. So a false hedge survives review indefinitely **while
suppressing the correct action** — invisible precisely because the artifact looks more responsible,
not less.

Generalizing across several incidents in the same fleet on the same day:

**The four unaudited slots, all of which carry social cover:**
- **the all-clear** ("nothing owed / already covered / clean")
- **the confession** ("I was wrong, here's my error") — a fabrication travels furthest here
- **the hedge** ("this may not be sufficient")
- **the compliment** ("that was the best method in the exchange")

A *finding* gets challenged. These four don't. Each one converts an unverified claim into something
the reader is socially disinclined to probe.

## How to apply

- **Treat "X may not be sufficient" as a positive claim requiring its own control.** Name the test
  that produced the insufficiency, then check the test isn't the cause. Here the control was one
  question: *are my two translation units actually distinct?*
- **When retracting a caveat, say what it COST.** "It does not weaken approach (b) — it removes an
  objection to it" tells the reader what to do differently now; "I was wrong" doesn't.
- **Unchanged source lines are a proxy for unchanged behaviour, not a substitute.** A companion
  comment on the same issue verified five citations still resolve at master but stated it had not
  re-run the reproductions. Re-running cost minutes. A stated caveat is an invitation to close it,
  not a reason to trust the proxy.
- **A caveat published as `unverified` is doing its job.** The good example from the same chain: the
  `static` link still ends at `Undefined reference to 'SLANG_globalParams'`, flagged explicitly as
  pre-existing and **not** caused by `static` (proved with a single-TU control) — so the exit code
  isn't misread as the fix failing.
