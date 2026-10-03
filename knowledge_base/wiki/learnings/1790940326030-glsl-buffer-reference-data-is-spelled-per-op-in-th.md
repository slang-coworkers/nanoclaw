---
title: "GLSL buffer_reference `._data` is spelled per-op in the emitter; derefs through emitDereferenceOperand emit the bare handle"
type: learning
topic: slang-compiler
source: learnings/1790940326030-glsl-buffer-reference-data-is-spelled-per-op-in-th.md
---

# GLSL buffer_reference `._data` is spelled per-op in the emitter; derefs through emitDereferenceOperand emit the bare handle

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790937554959-yyhm6x
written_at: 2026-10-02T11:25:26.030Z
---

# GLSL buffer_reference `._data` is spelled per-op in the emitter; derefs through emitDereferenceOperand emit the bare handle

On the GLSL target, a Slang `T*` (AddressSpace::UserPointer) is emitted as a `buffer_reference` block whose pointee is the member `_data` (emitBufferPointerTypeDefinition, slang-emit-glsl.cpp ~2151). `_data` exists only at emit time and has no IR field key, so "legalize to FieldAddress(_data)" is not possible on the current IR without a wrapper-struct lowering.

GLSL adds `._data` in only two places in `tryEmitInstExprImpl`: the Load arm, which skips it only when the address is directly a FieldAddress (a one-level exemption), and the FieldAddress arm (`base._data.f`). Every other dereference path drops it:
- Store, SwizzledStore and GLSL AtomicLoad/Store go through `CLikeSourceEmitter::emitDereferenceOperand`, which emits the bare operand when `!doesTargetSupportPtrTypes()`. Result: `C.p = 1.0`.
- GEP on the handle emits `p[i]`, which is buffer_reference2 pointer arithmetic, not element access.
- Atomic RMW ops use emitOperand(op0).

Nested field through a pointer (`p->inner.x`), an array inside the pointee (`a->v[1]`), `(*q)[2]` / `(*q).y` / `(*q).xy` on `float4* q`, `*p = v`, `p[1] = v`, and `InterlockedAdd(*p, ...)` all produce invalid GLSL (they fail `-emit-spirv-via-glsl`); direct SPIR-V handles all of them. The principled fix is one GLSL rule: make emitDereferenceOperand virtual and have the GLSL override emit `<handle>._data` for a UserPointer value that is not itself a FieldAddress/GEP of a UserPointer base. Then FieldAddress/GEP become `deref(base).f` / `deref(base)[i]`, the GLSL Load arm can be deleted, and atomic RMW operand 0 goes through deref. Prototype in #13393 triage: all 10 shapes fixed; only tests/spirv/pointer-2.slang's CHECK_GLSL changes, and only in parenthesization.

Quick check that the IR isn't the problem: `-target cpp` on the same source emits a correct `*p = 1.0f`. Dating: general GLSL pointers landed in #6511 (first release v2025.6.2), and 6.2 already emits the wrong store, so this is not a regression.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790940326030-glsl-buffer-reference-data-is-spelled-per-op-in-th.md`_
