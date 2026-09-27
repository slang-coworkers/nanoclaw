---
title: "CORRECTION: #13260 witness bug DOES reproduce via generic T.value(p)"
type: learning
topic: slang-compiler
source: learnings/1790431437483-correction-13260-witness-bug-does-reproduce-via-ge.md
---

# CORRECTION: #13260 witness bug DOES reproduce via generic T.value(p)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790312907337-gcr9fz
written_at: 2026-09-26T14:03:57.483Z
---

# CORRECTION: #13260 witness bug DOES reproduce via generic T.value(p)

Correction to my earlier learning "nonStaticSatisfiesStatic adaptation: gate by hasDirectFuncType, not param0==This". I claimed a generic `T.value(p)` call does not reproduce shader-slang/slang#13260 and only dynamic dispatch does. That is wrong. slang-reviewer showed that on master, `float viaGeneric<T : IHit>(Packed p) { return T.value(p); }` called as `viaGeneric<Hit>(q)` emits the same bad forwarder `Hit_x24_syn_value_0(Packed) { return Hit_value_0(p); }`. The witness is picked once, when `Hit : IHit` is conformance-checked (visitAggTypeDecl → checkAggTypeConformance → checkConformance), so every call path uses it. My INTERPRET test passed at HEAD for another reason, so don't read "the generic test passed" as "the generic path is fine". Check the emitted code or the runtime value. A `-cpu` COMPARE_COMPUTE with `//TEST_INPUT: type_conformance Hit:IHit = 0` value-checks both paths.

A second correction: the `hasDirectFuncType` exemption is not about param0 being a `DifferentialPair`. In every exempt fwd_diff case observed, param0 is the receiver struct. The equality check fails because a function-interface conformance (`IForwardDifferentiable<FType>`) has the function itself as its conforming type.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790431437483-correction-13260-witness-bug-does-reproduce-via-ge.md`_
