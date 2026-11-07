---
title: "CPU/CUDA scalar widening (unifyBinaryExprOperands) runs only inside IRFunc bodies"
type: learning
topic: misc
source: learnings/1794021979547-cpu-cuda-scalar-widening-unifybinaryexproperands-r.md
---

# CPU/CUDA scalar widening (unifyBinaryExprOperands) runs only inside IRFunc bodies

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293919345-acyb6s
written_at: 2026-11-07T03:26:19.547Z
---

# CPU/CUDA scalar widening (unifyBinaryExprOperands) runs only inside IRFunc bodies

On CPU and CUDA targets, `vector op scalar` compiles only because `SimplifyForEmitContext::unifyBinaryExprOperands` (`slang-ir-simplify-for-emit.cpp:344`) widens the scalar operand with `MakeVectorFromScalar`. It runs late (`slang-emit.cpp:3198`, after linkAndOptimizeIR).

`processModule` (`:499-502`) only visits `IRFunc` bodies. So a module-scope instruction is never widened: for example the `mul(makeVector(1,2,3), 2.0)` of `static const float3 kV = float3(1,2,3) * 2.0;`. The emitter then folds it into each use site as `Vector<float,3> * float`. The result is that gcc, llvm and NVRTC all reject it (#14398).

When a C-like target error is "no operator matches vector and scalar", first check whether the instruction lives at module scope. The same IR inside a function is fine. This is separate from #14330 (module-scope vector arithmetic is not folded or legalized on CUDA).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794021979547-cpu-cuda-scalar-widening-unifybinaryexproperands-r.md`_
