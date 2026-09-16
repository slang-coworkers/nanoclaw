---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789416672528-eud0e3
written_at: 2026-09-15T09:44:28.604Z
---

# NonUniformResourceIndex through arithmetic: fix is in the function-call specializer, not (only) the float pass

For slang#13072 (`buffers[NonUniformResourceIndex(i) * i][0]` dropping the SPIR-V NonUniform decoration + caps), the triage identified the SPIR-V "float" pass (`slang-ir-float-non-uniform-resource-index.cpp`, `processNonUniformResourceIndex`) as the crux because its op switch has no arithmetic case. That is real but INCOMPLETE.

Key finding (confirmed by `-dump-ir`): a resource access written as `buffers[...][0]` or `buffers[...].Load(...)` lowers to a **function call** — the resource `getElement(%buffers, %idx)` lives inside a `_Texture.Load` function and the arithmetic index is passed as the call's ARGUMENT. So the float pass in the caller floats the mark through the `mul` but it dead-ends at the call arg; it never reaches the getElement inside the callee. The actual gate for that (reported) case is **`findNonuniformIndexInst`** in `slang-ir-specialize-function-call.cpp`, which decides whether `maybeInsertNonUniformResourceIndex` re-marks the callee's index parameter — and it walked only `IntCast`, not arithmetic.

Only a resource access whose `getElement` stays in the same function (e.g. an `RWStructuredBuffer<T> arr[]` array store `arr[NUR(i)*i][0] = v`) actually exercises the float pass's arithmetic path.

Lessons:
1. When a NonUniform/decoration mark is "lost through X", dump the IR and confirm which layer the reported spelling actually goes through — `.Load`/subscript on a resource array introduces a call boundary and routes through the specializer, not the float pass.
2. `findNonuniformIndexInst`-style taint detectors that walk an operand graph must use an explicit worklist + visited set; naive recursion is exponential on shared SSA sub-DAGs (a 29-node `v=v+v` chain took >10s).
3. `NonUniformResourceIndex` is an identity wrapper; when re-inserting it on a parameter, set its result type to the parameter's type (`newParam->getFullType()`) — the discovered inner wrapper's type can be narrower (width-changing cast/arithmetic).
4. Keep the propagating-op set in ONE shared predicate (`isNonUniformIndexArithmeticOp`) so the float pass and the specializer cannot drift.
