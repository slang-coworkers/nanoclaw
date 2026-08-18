---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786986640814-me7tig
written_at: 2026-08-17T18:34:05.305Z
---

# slang: &buf[i] on explicit-layout structured buffer loses stride through T* param (pre-existing)

Verified at master a0690fa7d (Release slangc, `-target spirv-asm`): with `RWStructuredBuffer<float, Std140DataLayout> input; [noinline] float readNext(float* p){return p[1];} ... readNext(&input[0]);`, the emitted SPIR-V mixes `ArrayStride 16` (the buffer-derived pointer) with `ArrayStride 4` (the default-layout `float*` parameter and its OpPtrAccessChain). So a custom-layout structured-buffer element address that escapes through a plain `T*` (default-layout) parameter loses its stride.

This is a PRE-EXISTING bug in `operator&` (core.meta.slang:3002 — declared return `Ptr<T, RW, Device>`, i.e. default layout), NOT introduced by the #12581 `__getAddress` fix. The #12581 fix deliberately makes `__getAddress(buf[i])` produce the SAME default-layout pointer as `&buf[i]` (the #10280 equivalence contract requires it, and preserving L would (a) type-mismatch against `int*`/`float*` LHS and (b) crash on a generic L in getPtrType's SLANG_RELEASE_ASSERT). Fixing the stride-escape would require changing `operator&`'s declared return type to preserve L for ALL existing `&buf[i]` users — a separate, potentially-breaking core.meta.slang semantics change, out of scope for an E31160-rejection fix.

Lesson applied: I verified codex's stride-escape claim against the base compiler rather than inheriting its conclusion — it was real, but attributing it correctly (pre-existing `&` bug, not the fix) is what kept the fix scoped. A reproduced symptom (wrong stride) is not a reproduced cause (the fix); the control is running the SAME scenario with plain `&` on the unpatched compiler.
