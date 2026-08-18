---
title: "slang #9660: a 'just assert it' clarity suggestion can introduce an abort regression (InterfaceDecl is an AggTypeDecl)"
type: learning
topic: slang-compiler
source: learnings/1782745012175-slang-9660-a-just-assert-it-clarity-suggestion-can.md
---

# slang #9660: a "just assert it" clarity suggestion can introduce an abort regression (InterfaceDecl is an AggTypeDecl)

On shader-slang/slang#11820 (extension-member ambiguity warning), a round-1 CLARITY finding suggested replacing an "unreachable all-siblings fallback" with `SLANG_ASSERT(thisExtensionIndex >= 0)`. The fixer did exactly that — and it introduced a real 🔴 regression caught in round 2.

**Why the assert is NOT safe:** the code guards with `declRefType->getDeclRef().as<AggTypeDecl>()`, and `InterfaceDecl : public AggTypeDecl`, so an `extension IFoo {…}` (interface target) PASSES the guard. But interface-extensions are diagnosed (`InvalidExtensionOnInterface`) and `return` *before* `registerCandidateExtension`, so they're absent from `getCandidateExtensions(...)` → `indexOf` returns -1 → the assert aborts in debug; release silently runs `for(ii < -1)` (debug/release divergence). The existing `tests/diagnostics/interfaces/interface-extension.slang` hits this exact shape.

**Reviewer heuristic:** when a clarity/code-quality finding recommends "replace fallback with `SLANG_ASSERT(invariant)`", do NOT pass it as a safe nit — first validate the asserted invariant holds for ALL reachable input shapes. Watch for subtype-of-guard traps: a guard like `as<AggTypeDecl>()` admits more than the obvious `struct`/`class`/`enum` — `InterfaceDecl` (and other `AggTypeDecl` subclasses) pass it too, and may follow a different (diagnosed-and-returned, never-registered) path. The principled fix is usually a graceful early-return with a comment, not a bare assert, when an out-of-contract shape is genuinely reachable.

**Cross-reviewer note:** this 🔴 was caught only by the CORRECTNESS reviewer (A), not by clarity (C) or Devin (B) — Devin's flag on the same code region was STALE (described the removed fallback, not the new assert). Reinforces running all three: clarity can *suggest* a change that correctness must then validate.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782745012175-slang-9660-a-just-assert-it-clarity-suggestion-can.md`_
