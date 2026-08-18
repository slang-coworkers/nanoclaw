---
title: "Slang SPIR-V atomic emission has 4 cross-layer gates keyed on address space — check all when reviewing atomic/VUID fixes"
type: learning
topic: slang-compiler
source: learnings/1782346122322-slang-spir-v-atomic-emission-has-4-cross-layer-gat.md
---

# Slang SPIR-V atomic emission has 4 cross-layer gates keyed on address space — check all when reviewing atomic/VUID fixes

When reviewing a Slang SPIR-V fix for atomics on a buffer (esp. the legacy pre-1.4 `Uniform`/`BufferBlock` SSBO spelling, `isSpirv14OrLater() ? StorageBuffer : Uniform`), there are FOUR gates that each independently classify the atomic's pointer/address-space. A fix touching one frequently needs siblings, and the over-broadness of adding an `AddressSpace::` case is judged by which downstream gates constrain the input:

1. **Front-end l-value check → E30047** (`argument-expected-lvalue`, slang-diagnostics.lua). Rejects atomics on read-only targets (e.g. `ConstantBuffer<T>` member). Negative test: `tests/bugs/gh-8959-ubo-atomic.slang` asserts `error[E30047]`.
2. **IR validator `isValidAtomicDest`** (`source/slang/slang-ir-validate.cpp`) → **E41403** `invalid-atomic-destination-pointer`. This is **decoration-aware**: accepts `Uniform` ONLY if the pointee carries `kIROp_SPIRVBufferBlockDecoration` (writable SSBO), rejecting read-only `Block` UBOs. Runs in `slang-ir-spirv-legalize.cpp` (`skipFuncParamValidation=false`) BEFORE the emitter.
3. **Emitter `isAtomicableAddressSpace`** (`slang-emit-spirv.cpp`) — keys purely on address space (NOT decoration). Consulted ONLY by `AtomicLoad`/`AtomicStore`/`AtomicExchange`. Its `else` fallback is non-atomic `emitLoad`/`emitStore`; for the value-producing `AtomicExchange` the value-less `emitStore` leaves the result def unregistered → **SIGABRT** (spirv-tools def_use_manager). NOTE: `AtomicCompareExchange` and arithmetic atomics (`AtomicAdd`/etc.) do NOT consult this gate — they always emit the atomic op.
4. **Emitter `emitMemorySemanticMask`** (`slang-emit-spirv.cpp`) — maps address space → storage-class semantics bit (`Uniform`/`StorageBuffer`/`UserPointer`→`UniformMemoryMask`, `GroupShared`→`WorkgroupMemory`, `Image`→`ImageMemory`, `Output`→`OutputMemory`). Missing case → `memoryClass=0` → no storage-class bit → **VUID-StandaloneSpirv-MemorySemantics-10870** for non-relaxed atomics. Plain switch (no SLANG_EXHAUSTIVE_SWITCH), default falls through to 0.

Over-broadness verdict pattern: adding `AddressSpace::Uniform` to gates 3/4 is safe because gates 1+2 already reject read-only UBO atomics upstream — so the only `Uniform` pointer reaching the emitter gates is a writable BufferBlock SSBO. The decoration-aware gate is #2 (E41403), not the front-end #1 (E30047), though BOTH fire. Watch for: gate #4's switch omitting `Global`/`TaskPayloadWorkgroup` even though gate #3 marks them atomicable (potential latent VUID-10870, but pre-existing / no failing input). Verified during review of shader-slang/slang#11735 (PR fixing #11731).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782346122322-slang-spir-v-atomic-emission-has-4-cross-layer-gat.md`_
