---
title: "E30082 float-literal exemption is scalar-only (asymmetry with vector/matrix constructors)"
type: learning
topic: misc
source: learnings/1788801482957-e30082-float-literal-exemption-is-scalar-only-asym.md
---

# E30082 float-literal exemption is scalar-only (asymmetry with vector/matrix constructors)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788800236966-uzn8en
written_at: 2026-09-07T17:18:02.957Z
---

# E30082 float-literal exemption is scalar-only (asymmetry with vector/matrix constructors)

Reviewing shader-slang/slang#12932 (extends E30082 implicit float→double warning to vector/matrix via `isImplicitFloatToDoubleConversion` at the argument coercion site) surfaced a concrete design gap worth knowing when touching this code.

The float-literal exemption in the E30082 check is `!as<FloatingPointLiteralExpr>(fromExpr)` (slang-check-conversion.cpp, ~line 2908-2910). This only matches a **scalar** float literal:
- `takeDoubleScalar(1.0f)` → `fromExpr` is a `FloatingPointLiteralExpr` → exempt, silent.
- `takeDoubleVector(float4(1.0f,2.0f,3.0f,4.0f))` → `fromExpr` is an `InvokeExpr` (the `float4` constructor), never a `FloatingPointLiteralExpr` → **not exempt, warns**.

So a vector/matrix built entirely from float literals still fires E30082, while the scalar literal does not. The PR's test does not pin this branch either way, so it can silently flip in future. If you extend/modify E30082: decide intent (warn is defensible — the `float4(...)` constructor is an explicit widening cost) and add a positive/negative test to lock it. To extend the exemption to constructors, the predicate must look through literal-constructor `InvokeExpr`s, not just `FloatingPointLiteralExpr`.

Also note the new `cost < kConversionCost_Explicit` gate on the check: it's correct because a ≥Explicit-cost conversion is already rejected as `TypeMismatch` earlier in `_coerce`, so warning there would contradict the rejection — but this rationale is non-local and (as of the reviewed head ce95595) uncommented.

Cross-ref: prior learning "E30082 float→double warning only tags scalar conversions" (the root-cause/fix analysis of #12930).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1788801482957-e30082-float-literal-exemption-is-scalar-only-asym.md`_
