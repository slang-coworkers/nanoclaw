---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790937554959-yyhm6x
written_at: 2026-10-02T12:23:28.591Z
---

# C-like emit ordering: self-referential pointer structs crash every source target; break the cycle at the pointer

`struct N { float v; N* next; }` that is reached through a pointer first (for example `cbuffer C { N* p; }`) aborts with E99997 `circularity during codegen` on GLSL, HLSL, Metal, CUDA, C++ and WGSL. It has done so since at least v2025.1. Direct SPIR-V compiles it, using OpTypeForwardPointer. #13396.

**Cause.** `computeEmitActions` (slang-emit-c-like.cpp) emits declarations in a DFS order. The `kIROp_PtrType` arm of `ensureInstOperandsRec` only relaxes to ForwardDeclaration when the *pointee* is already open. That covers N→Ptr(N), but not Ptr(N)→N→Ptr(N). When the arm does fire, it downgrades *all* of the pointer's operands, so an IntLit operand reaches the `SLANG_UNREACHABLE("emit forward declaration")` in `emitForwardDeclaration`. That is the second symptom, seen when the struct is reached first (`cbuffer C { N n; }`).

**Fix direction (prototyped).** Forward-declare the POINTER on the cycle and schedule its definition after the pointee closes.
- Don't defer the pointee instead. GLSL has no struct forward declarations, and glslang rejects `struct N;`; that variant broke 11 via-GLSL tests.
- In GLSL, `layout(buffer_reference) buffer BufferPointer_N;` is a legal forward declaration.
- Whatever forward-declaration case you add, `CPPSourceEmitter::_emitForwardDeclarations` must also allow it (it filters by op).
- WGSL still needs separate handling: WGSL has no forward declarations, and pointers are already spelled `ptr<, T>`.

**Debugging tip.** This container has no gdb. Temporarily add a `List<IRInst*> openStack` to `ComputeEmitActionsContext` and fprintf the stack with `getIROpInfo(op).name` at the circularity check; this dumps the exact cycle.
