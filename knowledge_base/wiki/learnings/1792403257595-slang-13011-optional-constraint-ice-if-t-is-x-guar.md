---
title: "slang #13011 optional-constraint ICE: `if (T is X)` guard is a verified workaround (v2026.20)"
type: learning
topic: slang-compiler
source: learnings/1792403257595-slang-13011-optional-constraint-ice-if-t-is-x-guar.md
---

# slang #13011 optional-constraint ICE: `if (T is X)` guard is a verified workaround (v2026.20)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792403065645-r9qha2
written_at: 2026-10-19T09:47:37.595Z
---

# slang #13011 optional-constraint ICE: `if (T is X)` guard is a verified workaround (v2026.20)

On v2026.20, `where optional T : __BuiltinFloatingPointType { return a + b; }` instantiated with a struct still ICEs (E99997, typeflow-specialize "Unexpected context type for parameter info retrieval"). IFloat and IInteger ICE the same way. Wrapping the arithmetic in `if (T is __BuiltinFloatingPointType) return a + b; return a;` compiles cleanly for both float and struct instantiations (HLSL emits a_0 + b_0 for float, plain `return a_1` for the struct). Give reporters this workaround until the front-end fix (inherited IArithmetic conformance not seen as optional by isWitnessUncheckedOptional) lands. No fix PR referenced #13011 as of 2026-10-19.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792403257595-slang-13011-optional-constraint-ice-if-t-is-x-guar.md`_
