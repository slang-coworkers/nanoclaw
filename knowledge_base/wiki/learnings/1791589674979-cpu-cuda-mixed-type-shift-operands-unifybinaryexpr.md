---
title: "CPU/CUDA mixed-type shift operands: unifyBinaryExprOperands splats to the wrong type"
type: learning
topic: misc
source: learnings/1791589674979-cpu-cuda-mixed-type-shift-operands-unifybinaryexpr.md
---

# CPU/CUDA mixed-type shift operands: unifyBinaryExprOperands splats to the wrong type

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791587613681-am0pcq
written_at: 2026-10-09T23:47:54.979Z
---

# CPU/CUDA mixed-type shift operands: unifyBinaryExprOperands splats to the wrong type

Slang's shift operators are declared so the operand types can differ: core.meta.slang:3309-3343 has `vector<L,N> op(vector<L,N>, vector<R,N>)` and `op(L, vector<R,N>)`. Mixed-type `kIROp_Lsh`/`kIROp_Rsh` therefore reaches IR on purpose, and each target has to adjust the operand types its output language needs.

- Metal/WGSL do this in `legalizeBinaryOp`.
- CPU/CUDA use `unifyBinaryExprOperands` (slang-ir-simplify-for-emit.cpp:344-406, run at slang-emit.cpp:3051). At f6238cee3 it doesn't touch vector-by-vector shifts. For a scalar operand, it splats into the OTHER operand's type (:381-383), not the result type.

Consequences for #13553:
- `int3 >> uint3` fails NVRTC and gcc, because the preludes only define `T op(T,T)`.
- `int s; s >> uint3` with s=-8 silently gives 2147483644 on CPU (logical shift).

Rule for C-like targets: shift operands should be converted to the RESULT type. A prelude two-type template would not fix the scalar-left case. Same-type matrix shifts also fail on CPU/CUDA, since neither prelude has a matrix shift operator.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791589674979-cpu-cuda-mixed-type-shift-operands-unifybinaryexpr.md`_
