---
title: "Slang fake-overload diagnostics: mirror the real constraint family — conversion cost outranks rank, and module locality rules"
type: concept
group: slang-compiler
tags: [slang, overload-resolution, fake-overloads, fallback-overloads, CompareOverloadCandidates, OverloadRank, conversion-cost, __BuiltinArithmeticType, __BuiltinFloatingPointType, core.meta.slang, hlsl.meta.slang, diagnostic-on-reference, E39999, mul, matrix-vector, #14546, PR #14647]
source_count: 2
---

# Slang fake-overload diagnostics: the constraint-family rule and its gotchas

tangent-vector's "diagnostic-on-reference attribute + fake low-rank overloads" pattern (implemented for slang#14546, PR #14647) adds a "selected only when nothing real matches" fallback operator for matrix-vector shapes so a clear diagnostic fires. Two non-obvious rules decide whether the fakes steal resolution from the real overloads. General overload-resolution mechanics are on [[wiki/concepts/slang-language-coercion-and-overload.md]].

## TL;DR

- **A fake overload competes on per-argument conversion cost BEFORE [OverloadRank]** (`CompareOverloadCandidates`), so rank can never save a real overload from a cheaper conversion — the fake's constraint shape must be no more permissive on any argument than the overloads it must lose to.
- **Mirror the real candidate's constraint FAMILY exactly**: a fallback constrained to `__BuiltinFloatingPointType` was SELECTED for `matrix * scalar` inside the stdlib's FP-constrained generic bodies (radians, `__smoothstep_impl`) and stole resolution from the real rank-10 generic; constraining it to the real family's own `__BuiltinArithmeticType` eliminated the theft.
- **Module locality overrides co-location with the builtin you point at**: the fakes for `mul` live in `core.meta.slang` even though `mul` lives in `hlsl.meta.slang` — the core module cannot reference hlsl-module decls in its bodies, so fakes are body-less (fine: referencing them is an error, so the body would never emit, but any plan forwarding a fake's body to a builtin in another module is a non-starter).
- **Verify the constraint choice by building the core module**: the narrower constraint fails at exactly the stdlib sites that steal resolution; the mirrored one builds clean.

## The constraint-family rule and the theft it prevents

When adding the fallback operator for matrix-vector shapes, a version constrained to `__BuiltinFloatingPointType` was SELECTED for `matrix * scalar` inside the stdlib's FP-constrained generic bodies and stole the resolution from the real rank-10 generic — because `CompareOverloadCandidates` compares per-argument conversion cost strictly before rank, and the fallback's scalar→vector broadcast undercut the real overload's cost there. Constraining the fallback to the real overloads' own family (`__BuiltinArithmeticType`) eliminated the theft. Recipe: mirror the real candidate's constraint family exactly, and verify by building the core module with the narrower constraint (fails at exactly those sites) vs the mirrored one (clean) ([cost outranks rank](../learnings/1795145055847-slang-fallback-overload-diagnostics-mirror-the-rea.md), [constraint narrowness beats OverloadRank](../learnings/1795145077733-slang-fake-overload-gotchas-module-locality-constr.md); rank is the last tie-breaker, slang-check-overload.cpp:2410-2413, skipped for Generic-flavor passes).

Gotchas hit on the way, all from the same #14546 chain: the builtin-operator fast path declines `matrix<abstract-element> * scalar` (which is why those sites reach resolution at all); `mul` lives in the separate hlsl module so core.meta.slang fakes must be body-less; the glsl module's mat-vec overload keys the vector on the matrix's ROW count (so `float3x4*float3` is the GLSL algebraic shape, while `float3x4*float4` hits the fallback); E39999's candidate notes are uncoded (diag -1) so `CHECK-NOT: note[` cannot catch them — use `CHECK-NOT: see overloads considered`; and multi-arg type-call constructors DO flow through the decl-ref funnel (the attribute goes on the `__init`; only single-arg coercion via `coerce()` bypasses). The attribute fires via the ConstructDeclRefExpr funnel (slang-check-expr.cpp:512 → `diagnoseUsageAttrDeclRefUsage`, PR-renamed). Full trace in the fixer chain's memory: fix-14546.md [same].

**Source learnings (2):**
- [conversion cost strictly precedes rank; mirror the real constraint family (__BuiltinArithmeticType, not narrower); plus glsl row-count keying, E39999 uncoded notes, __init attribute funnel](../learnings/1795145055847-slang-fallback-overload-diagnostics-mirror-the-rea.md)
- [fakes live in core.meta.slang (module locality, body-less) because core cannot reference hlsl-module decls; a fake's constraints must not be narrower than the real family it shadows](../learnings/1795145077733-slang-fake-overload-gotchas-module-locality-constr.md)

_Catalog: [[wiki/index.md]]_
