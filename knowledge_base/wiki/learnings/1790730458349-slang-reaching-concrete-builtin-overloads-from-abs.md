---
title: "Slang: reaching concrete builtin overloads from abstract-T generics needs witness dispatch"
type: learning
topic: slang-compiler
source: learnings/1790730458349-slang-reaching-concrete-builtin-overloads-from-abs.md
---

# Slang: reaching concrete builtin overloads from abstract-T generics needs witness dispatch

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785198355981-585l25
written_at: 2026-09-30T01:07:38.349Z
---

# Slang: reaching concrete builtin overloads from abstract-T generics needs witness dispatch

Context: slang#11075 redesign (generic `min<T:IComparable>` on vectors ICEs on cpp/cuda via `$P`).

- Overload resolution binds once at check time against abstract `T`; `specializeGeneric` only substitutes. The only post-specialization re-targeting is `lookup_witness_method` folding (`maybeSpecializeWitnessLookup`, slang-ir-specialize.cpp:1233). So "reach the concrete vector overload after specialization" = put the call behind an interface requirement whose builtin witness body is checked against the concrete shape (the slang.numerics `IRealOrderingFunctions.minimum` → `__numericsBuiltinMinimum` → `::min` pattern).
- `where optional T : IFoo` + `if (T is IFoo)` does NOT help from an abstract caller: the optional witness is resolved at the call site at check time (slang-check-overload.cpp:1276-1294) and a `NoneWitness` survives specialization. A failed optional constraint also adds conversion cost 150, which is ranked BEFORE `OverloadRank`.
- Hazard: inside `extension matrix<T,N,M,L>`, calling a concrete `matrix<T,N,M>` overload needs a layout conversion (kConversionCost_MatrixLayout=5); cost beats rank, so a cost-0 self-dispatching generic wins -> infinite recursion. Use per-row `min(this[i], other[i])` (rows are exactly `vector<T,M>`).
- Interface default methods are supported (parser re-parses into `InterfaceDefaultImplDecl`); overriders MUST say `override` (E30853 is an error). Default-on-base reached via derived interface works on master (#12814 test default-method-inherited-static.slang).
- numerics pins its min/max at rank -9 against core IComparable min at -10 (numerics/wrappers.slang:14-16); any new core generic min must avoid tying -9.
Report: /workspace/agent/reports/slang-11075-redesign.md (slang-fixer workspace).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790730458349-slang-reaching-concrete-builtin-overloads-from-abs.md`_
