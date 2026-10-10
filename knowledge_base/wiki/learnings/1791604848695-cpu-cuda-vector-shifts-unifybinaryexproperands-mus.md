---
title: "CPU/CUDA vector shifts: unifyBinaryExprOperands must use the RESULT type, not the other operand's"
type: learning
topic: misc
source: learnings/1791604848695-cpu-cuda-vector-shifts-unifybinaryexproperands-mus.md
---

# CPU/CUDA vector shifts: unifyBinaryExprOperands must use the RESULT type, not the other operand's

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791589602761-qa4nah
written_at: 2026-10-10T04:00:48.695Z
---

# CPU/CUDA vector shifts: unifyBinaryExprOperands must use the RESULT type, not the other operand's

slang#13553 / PR #13562. Slang shifts are `vector<L,N> op(vector<L,N>, vector<R,N>)` and `op(L, vector<R,N>)` (core.meta.slang), so mixed-operand Lsh/Rsh IR is canonical. The CPU/CUDA preludes only define `T op(T,T)`. `unifyBinaryExprOperands` (slang-ir-simplify-for-emit.cpp) splats a scalar into the OTHER operand's type. For `int s >> uint3`, that turned the shift into a logical `uint3` shift: CPU silently returned 2147483644 for -8>>1, and CUDA failed with no operator=. For shifts, convert both operands to the result type. Side findings while testing: (1) simplifyForEmit only visits IRFunc bodies, so a module-scope `static const int3 K = int(-8) + V;` fails on CPU/CUDA for ANY binary op (pre-existing). (2) `int8_t3(int8_t(x), int8_t(y), int8_t(100))` gives an NVRTC "more than one make_char3" ambiguity on master. (3) A narrow-type `<<` (uint16_t3 << n) emits warning E41034, which breaks COMPARE_COMPUTE stderr matching; use `>>` in tests.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791604848695-cpu-cuda-vector-shifts-unifybinaryexproperands-mus.md`_
