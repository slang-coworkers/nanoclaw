---
title: "RWByteAddressBuffer atomic-via-helper flips whole-module buffer type (shared dedup type inst mutation)"
type: learning
topic: misc
source: learnings/1785339952123-rwbyteaddressbuffer-atomic-via-helper-flips-whole-.md
---

# RWByteAddressBuffer atomic-via-helper flips whole-module buffer type (shared dedup type inst mutation)

**Issue:** shader-slang/slang#12265. `InterlockedAdd` on a `RWByteAddressBuffer` passed into a helper function silently corrupts `Load`/`Store` indexing on the C++/CPU target.

**Root cause (verified @HEAD 1eeb3b29d, IR dump + emitted C++/SPIR-V/GLSL/Metal):** `getEquivalentStructuredBuffer`'s **IRParam branch** at `source/slang/slang-ir-byte-address-legalize.cpp:1178-1186` does `babType->replaceUsesWith(structuredBufferType)`. Because Slang IR types are **deduplicated** (one `RWByteAddressBuffer` type inst is shared by the helper param, the global buffer's field, and every `load` of it), `replaceUsesWith` on that shared type inst flips *every* `RWByteAddressBuffer` in the module to `RWStructuredBuffer<uint32_t>` — not just the one param. The byte-address `Load`/`Store` are then left with byte offsets that were never divided by the element stride.

**Why C++/CPU-only (today):** the byte-offset→element-index `÷ stride` rewrite in `processLoad`/`emitSimpleLoad` (`:860`) is gated on `ByteAddressBufferLegalizationOptions.translateToStructuredBufferOps`. That flag is `true` for GLSL/SPIRV (they rewrite the load → correct), Metal uses `treatGetEquivalentStructuredBufferAsGetThis`+`lowerBasicTypeOps` (raw pointer, `offset>>2` → correct), but **false for CPU/C++** → `.Load<uint32_t>(12U)` on a structured buffer reads element 12 instead of 3. Per-target matrix at `slang-emit.cpp:2019-2132`.

**Contrast that pins it:** the **global-param branch** (`:1102-1104` → `createEquivalentStructuredBufferParam`) creates a *new, separate* cached structured-buffer global and leaves the original byte-address global intact — that's why the same shader WITHOUT the helper call is correct (emits a local `.asStructuredBuffer<>()` view). Only the IRParam branch mutates in place.

**General lesson:** In Slang IR, a byte-address / resource type is a shared deduplicated inst. Never `replaceUsesWith` on a *type* inst to "convert one value's type" — it rewrites every value of that type module-wide. Build a per-use cast/view value at the use site instead (as the global-param and `CastDynamicResource` branches do). When triaging "type got changed but its operations didn't follow," check for `replaceUsesWith` on a shared type inst.

**Recommended fix:** make the IRParam branch non-mutating (local structured-buffer view at the atomic use site). Consumer-side patching (loosening the translate flag) was rejected as un-principled per the repo methodology.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785339952123-rwbyteaddressbuffer-atomic-via-helper-flips-whole-.md`_
