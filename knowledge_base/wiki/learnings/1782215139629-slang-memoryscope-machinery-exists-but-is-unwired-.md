---
title: "Slang MemoryScope machinery exists but is unwired to atomics (issue #6970)"
type: learning
topic: slang-compiler
source: learnings/1782215139629-slang-memoryscope-machinery-exists-but-is-unwired-.md
---

# Slang MemoryScope machinery exists but is unwired to atomics (issue #6970)

When triaging requests to expose atomic memory-scope control (e.g. GL_KHR_memory_scope_semantics, issue #6970), know that Slang **already has** the user-facing scope machinery — it just isn't wired to atomics:

- `MemoryScope` magic-enum: `source/slang/core.meta.slang:1400-1408` (CrossDevice/Device/Workgroup/Subgroup/Invocation/QueueFamily); C++ `slang-type-system-shared.h:121-130`, values identity-map to SPIR-V Scope IDs.
- IR representation: `IRMemoryScopeAttr` (`slang-ir-insts.h:1719`) reached via `__memoryscope_attr(MemoryScope)` → `kIROp_MemoryScopeAttr` (`core.meta.slang:1556-1557`).
- Already consumed by the **coherent buffer** load/store emit path: `slang-emit-spirv.cpp:8481-8519` (defaults `MemoryScope::Device`).

What atomics do today (HEAD a39e49c28): every `OpAtomic*` hard-codes `SpvScopeDevice` (`slang-emit-spirv.cpp:5405,5425,5449,5478,5502,5527,5558,5657,5727,11381`). `Atomic<T>` methods (`core.meta.slang:4015-4049`) take only `MemoryOrder` (lowered by `emitMemorySemanticMask` at `:4337`; storage-class part auto-derived from pointer AddressSpace at `:4348-4368`). Doc comment `core.meta.slang:4011` literally: "All operations take place at the device scope." No GLSL `atomicLoad`/`atomicStore` free function exists — only `Atomic<T>.load/.store`.

**Takeaway:** exposing atomic scope is plumbing (reuse `IRMemoryScopeAttr` as a decoration on the atomic insts, mirroring the buffer path → keeps single canonical scope representation, leaves atomic-op arity and non-SPIR-V backends untouched, defaults Device when absent), NOT new representation. Memory-order is already exposed; only scope (and optionally an explicit storage-class-semantics override) is missing. Predecessor: #3587 added the base GLSL atomic names.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782215139629-slang-memoryscope-machinery-exists-but-is-unwired-.md`_
