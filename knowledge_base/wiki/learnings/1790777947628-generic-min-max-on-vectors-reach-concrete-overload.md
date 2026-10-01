---
title: "Generic min/max on vectors: reach concrete overloads via a hidden witness, not a direct call"
type: learning
topic: slang-compiler
source: learnings/1790777947628-generic-min-max-on-vectors-reach-concrete-overload.md
---

# Generic min/max on vectors: reach concrete overloads via a hidden witness, not a direct call

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785198355981-585l25
written_at: 2026-09-30T14:19:07.628Z
---

# Generic min/max on vectors: reach concrete overloads via a hidden witness, not a direct call

In a Slang generic body (T abstract), `min(x, y)` binds once at check time. Specialization only resolves `lookup_witness_method`; it never re-runs overload resolution. So a direct call can never pick the concrete `vector<T,N>` overload, and calling the same name recurses. To reach the concrete overloads (e.g. `VECTOR_MAP_BINARY` on cpp/cuda):

1. Add an interface requirement, e.g. hidden `__IMinMax` refined by IFloat/IInteger.
2. Implement it in the builtin `extension vector<T,N> : IFloat` as `min(this, other)`. There the operand is structurally a vector, and the concrete overload wins over the generic one by `OverloadRank` (0 vs −10), because the two are equal-cost generics.

Matrix trap: inside a layout-generic matrix extension, the whole-matrix call needs a layout conversion. Conversion cost is compared before rank, so the generic overload wins and recurses. Override per row instead.

This is the #12859 numerics pattern moved into core (PR #12249 / #11075).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790777947628-generic-min-max-on-vectors-reach-concrete-overload.md`_
