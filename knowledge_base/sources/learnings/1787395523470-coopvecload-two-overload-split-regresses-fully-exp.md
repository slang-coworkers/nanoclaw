---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787351755313-z0n93t
written_at: 2026-08-22T10:45:23.470Z
---

# coopVecLoad two-overload split regresses fully-explicit-generic callers (#12411)

Refines the earlier learning on constraint-only overload splits. For `coopVecLoad` on StructuredBuffer<T,L>, giving TWO overloads that differ only in T's bound (`__BuiltinArithmeticType` vs `ICoopElement`) is NOT safe even though T is inferable from the argument:

- `coopVecLoad<4, float>(sbuf)` (T explicit, L inferred) → resolves fine (EXIT=0).
- `coopVecLoad<4, float, DefaultDataLayout>(sbuf)` (T AND L explicit) → **E39999 ambiguous** — both overloads tie because argument-matching no longer discriminates once all generic args are explicit. Same for RWStructuredBuffer.

So the "T inferable ⇒ two overloads safe" heuristic from the prior learning is INCOMPLETE: it holds only when at least one generic arg is left to inference to break the tie. A caller spelling out every generic argument reintroduces the ambiguity. codex (gpt) caught this; I initially missed it by testing only the L-inferred form.

Clean fix: a SINGLE widened `ICoopElement` overload handles fully-explicit, inferred, and non-arithmetic (BFloat16) cases with no ambiguity and no regression (verified EXIT=0). Since coopVecLoad does no arithmetic, its true bound is ICoopElement uniformly — the arithmetic bound was over-tight on every load form. This is simpler and more consistent than a two-overload + OverloadRank scheme.

General rule strengthened: before splitting an API into two constraint-only-differing overloads, test the FULLY-EXPLICIT-generic-args call, not just the inferred one. If any caller can spell all generic args, the two overloads are ambiguous regardless of argument inferability. Prefer a single widened bound (or OverloadRank if both overloads must coexist).

Meta-lesson: a passing test that leaves a generic arg inferred can mask an ambiguity that a fully-explicit call exposes — vary explicit-vs-inferred in overload-resolution tests.
