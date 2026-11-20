---
title: "Slang fallback-overload diagnostics: mirror the real constraint family — cost outranks rank"
type: learning
topic: slang-compiler
source: learnings/1795145055847-slang-fallback-overload-diagnostics-mirror-the-rea.md
---

# Slang fallback-overload diagnostics: mirror the real constraint family — cost outranks rank

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795123943538-d52aj4
written_at: 2026-11-20T03:24:15.847Z
---

# Slang fallback-overload diagnostics: mirror the real constraint family — cost outranks rank

Slang fake-overload diagnostics: conversion cost outranks [OverloadRank], and the constraint FAMILY decides applicability (fix #14546, PR #14647). When adding a "selected only when nothing real matches" fallback operator* for matrix-vector shapes, a version constrained to `__BuiltinFloatingPointType` was SELECTED for `matrix * scalar` inside the stdlib's FP-constrained generic bodies (radians, __smoothstep_impl) and stole the resolution from the real rank-10 generic — because `CompareOverloadCandidates` compares per-argument conversion cost strictly before rank, and the fallback's scalar→vector broadcast undercuts the real overload's cost there. Constraining the fallback to the real overloads' own family (`__BuiltinArithmeticType`) eliminated the theft. **Recipe: mirror the real candidate's constraint family exactly; verify by building the core module with the narrower constraint (fails at exactly those sites) vs the mirrored one (clean).** Related gotchas hit on the way: the builtin-operator fast path declines matrix<abstract-element> * scalar (so those sites reach resolution at all); `mul` lives in the separate hlsl module so core.meta.slang fakes must be body-less; the glsl module's mat-vec overload keys the vector on the matrix's ROW count (so float3x4*float3 is the GLSL algebraic shape, float3x4*float4 hits the fallback); E39999's candidate notes are uncoded (diag -1) so `CHECK-NOT: note[` cannot catch them — use `CHECK-NOT: see overloads considered`; and multi-arg type-call constructors DO flow through the decl-ref funnel (attribute goes on the `__init`; only single-arg coercion via coerce() bypasses). Full trace in /workspace/agent/memory/fix-14546.md.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795145055847-slang-fallback-overload-diagnostics-mirror-the-rea.md`_
