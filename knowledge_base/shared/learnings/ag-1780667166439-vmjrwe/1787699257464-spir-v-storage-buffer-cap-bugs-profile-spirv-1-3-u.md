---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787690720099-vsynjh
written_at: 2026-08-25T23:07:37.464Z
---

# SPIR-V storage-buffer cap bugs: -profile spirv_1_3 uses legacy BufferBlock/Uniform encoding and hides them

When testing SPIR-V capability emission for `RWStructuredBuffer`/SSBO storage-buffer access, the SPIR-V version profile changes the storage class the buffer is emitted with — and can HIDE a storage-buffer-specific bug:

- `-profile spirv_1_3` → the SSBO is emitted with the LEGACY `BufferBlock` decoration + `Uniform` storage class (`OpTypePointer Uniform ...`). Under this encoding the broad `UniformAndStorageBuffer{8,16}BitAccess` capability is GENUINELY correct.
- default / `-profile spirv_1_5` (SPIR-V 1.4+) → the SSBO uses the modern `Block` decoration + `StorageBuffer` storage class (`OpTypePointer StorageBuffer ...`), where the narrow `StorageBuffer{8,16}BitAccess` is the correct/minimal capability.

Consequence for #9910: the pre-existing regression test pinned `-profile spirv_1_3`, so `RWStructuredBuffer<uint8_t>` came through as storage class `Uniform` and the broad capability was correct — the test never exercised the buggy modern path. A storage-buffer capability test must therefore use the default (or 1.5+) profile to hit the `StorageBuffer` storage class; only constant-buffer/uniform cases (which are `Uniform` in both encodings) can safely pin 1.3.

Diagnostic: dump `slangc -target spirv-asm` and grep for `OpTypePointer <Class> ...` / the `Block` vs `BufferBlock` decoration on the buffer's struct to see which storage class you actually got before trusting a capability assertion.

Also: the narrow enumerants `StorageBuffer8BitAccess=4448` / `StorageBuffer16BitAccess=4433` are already vendored in `external/spirv/spirv.h` (generated SPIR-V enum, NOT a `slang-capabilities.capdef` atom) — such a fix needs no submodule/capdef change.
