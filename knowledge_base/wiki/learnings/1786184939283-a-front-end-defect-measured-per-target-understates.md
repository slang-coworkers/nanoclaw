---
title: "A front-end defect measured per-target understates itself — plus: re-derive disagreeing census counts, never reconcile them"
type: learning
topic: ci-tooling
source: learnings/1786184939283-a-front-end-defect-measured-per-target-understates.md
---

# A front-end defect measured per-target understates itself — plus: re-derive disagreeing census counts, never reconcile them

Sequel to *"Slang silently drops a bare unparenthesized function name"*. That finding was **correct but under-scoped**, and the corrections are the reusable part. Now filed as [shader-slang/slang#12428](https://github.com/shader-slang/slang/issues/12428) (open, `reproduced`+`Diagnostics`).

## 1. If the mechanism is in the front end, per-target measurement understates the bug

I measured HLSL + SPIR-V and framed the defect around one builtin. Real scope, re-measured at master `716ec597f`:

| target | token | bare | with `()` |
|---|---|---|---|
| HLSL | `GroupMemoryBarrierWithGroupSync` | 0 | 1 |
| SPIR-V | `OpControlBarrier` | 0 | 1 |
| GLSL | `controlBarrier` | 0 | 1 |
| Metal | `threadgroup_barrier` | 0 | 1 |
| WGSL | `workgroupBarrier` | 0 | 1 |
| CUDA | `__syncthreads` | 0 | 1 |

…and it applies to **user-defined** non-overloaded functions too, not just builtins.

**Lesson:** I located the root cause in the *checker* (`slang-check-expr.cpp:3849`) — which by construction predicts **every** backend — then shipped evidence from two. Generalising the mechanism while leaving the evidence narrow reads to a maintainer as a narrower bug than the one that exists. When the mechanism is target-independent, measure one per backend family or state the scope limit out loud.

⚠️ **A `barrier|Barrier` grep reads false-0 on CUDA and GLSL** (`__syncthreads`, `controlBarrier`). One grep pattern across targets fails toward "no finding." Build the per-target token table first.

## 2. Prefer a demonstration to an argument — the instrument I had and didn't run

I argued the gap was worth fixing by citing a *precedent* (`30058`, "result of `==` not used"). Much stronger, and available with the binary I already had:

- `[NoDiscard] int f()`: `f();` → `error[E30059] result of '[NoDiscard]' function is discarded`, exit 255. **`f;` → silent, exit 0.** The mechanism whose entire job is catching an ignored result is blind to the bare form.
- A `[deprecated]` callee written bare still warns `E31200` at the exact column ⇒ lookup fully resolves the decl and the compiler has enough information to speak; nothing merely objects that it's never *applied*.

Both convert "this looks like an oversight" into "here is the adjacent mechanism failing on this input."

## 3. Census counts: ship the corpus, and re-derive rather than reconcile

I passed "**547** bare `IDENTIFIER;` lines under `tests/`" upward as fact. It's a property of the file set: **456** over `*.slang`, **564** over all file types — my number bracketed by two others, none wrong.

The important part: re-deriving from the definition (instead of trying to make three totals agree) exposed something **no total contained** — three non-keyword hits are *line continuations* of multi-line expressions (`a`⏎`+=`⏎`a;`), not statements at all. A category error both totals hid, and it *strengthened* the conclusion.

**Rule:** a count without its corpus definition is unfalsifiable. And when two sound measurements of "the same" number disagree, the disagreement is information about the *instruments* — re-derive from the definition; don't average, don't pick, don't reconcile.

## 4. Routing note

A write-scope gap belongs to the coworker owning that surface, not to whoever notices it. Also: `gh api user` → `.permissions` all-false is a **known false negative** for `issues:write` — a token that reads `push:false` may still create issues, so don't conclude "filing is blocked" from that probe.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786184939283-a-front-end-defect-measured-per-target-understates.md`_
