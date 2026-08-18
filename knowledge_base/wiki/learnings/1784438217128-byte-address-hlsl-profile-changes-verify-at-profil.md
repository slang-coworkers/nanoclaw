---
title: "Byte-address / HLSL-profile changes: verify at -profile cs_5_0, not just -target hlsl (fxc has no templated .Load<T>)"
type: learning
topic: verification
source: learnings/1784438217128-byte-address-hlsl-profile-changes-verify-at-profil.md
---

# Byte-address / HLSL-profile changes: verify at -profile cs_5_0, not just -target hlsl (fxc has no templated .Load<T>)

**Gotcha:** a byte-address-buffer (or any HLSL-profile-sensitive) codegen change can pass all `-target hlsl` / `-target spirv` checks yet break the **fxc / DX ≤ 5.0** path, because that path sets a different legalization option: `byteAddressBufferOptions.useBitCastFromUInt = true` (in `slang-emit.cpp`, gated on `profile.getFamily()==DX && profile.getVersion() <= DX_5_0`). fxc-era HLSL has **no templated `.Load<T>`/`.Store<T>`** on byte-address buffers — such accesses must be lowered to untemplated `uint` `Load()`/`Store()` + `asfloat`/`asuint` bitcasts.

**Real case (slang#11803):** the #11545 point-5 chunker (`emitLegalChunkedVectorLoad/Store` in `slang-ir-byte-address-legalize.cpp`) split a partial-aligned `float4`@8 into typed `float2` sub-chunks. On modern HLSL that's fine (`.Load<float2>`); on cs_5_0 it emitted fxc-uncompilable `.Load<float2>`. The regression was CI-invisible because the feature tests used `-target hlsl`/`-target spirv` (no profile), never `-profile cs_5_0`. The shadow-approver caught it by source trace; a build+compile at cs_5_0 confirmed it.

**Rules:**
- When touching byte-address lowering or anything profile-gated, ALSO compile a repro at `-target hlsl -profile cs_5_0` and check the emit contains NO templated `Load<`/`Store<` and NO typed vector (`float2`/`float4`) — only untemplated `Load(`/`Store(` + `asfloat`/`asuint`.
- Add a `-profile cs_5_0` regression test so the fxc path is CI-visible.
- Note: the vector `useBitCastFromUInt` branch in `emitLegalLoad`/`emitLegalStore` is DEAD for concrete-element-count vectors (the `if(elementCountInst)` block always returns first) — so fxc-compat for vectors relies on the scalarize path (`emitLegalSequenceLoad/Store`), whose per-scalar loads DO hit the basic-type `useBitCastFromUInt` bitcast branch. Fix was to scalarize (fall back to `emitLegalSequenceLoad/Store`) when `useBitCastFromUInt` is set, rather than chunk.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1784438217128-byte-address-hlsl-profile-changes-verify-at-profil.md`_
