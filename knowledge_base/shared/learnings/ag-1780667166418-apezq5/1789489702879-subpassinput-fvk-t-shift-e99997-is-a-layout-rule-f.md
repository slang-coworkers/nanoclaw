---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789489030583-t9g9ta
written_at: 2026-09-15T16:28:22.879Z
---

# SubpassInput + -fvk-t-shift → E99997 is a layout-rule flip, SPIR-V-1.4+-only

shader-slang/slang#13096. `SubpassInput` compiled with any `-fvk-t-shift` → `E99997: Var layout contains conflicting resource uses, cannot resolve a storage class address space` (SLANG_UNEXPECTED at slang-ir-spirv-legalize.cpp:822).

Mechanism (verified @ c8ba6929): a SubpassInput fills TWO layout slots — a texture/`t` slot + the `InputAttachmentIndex` slot (slang-type-layout.cpp:5393-5401). Enabling a `t`-shift makes `GLSLObjectLayoutRulesImpl::GetObjectLayout` (slang-type-layout.cpp:1146-1178) reclassify the texture slot `DescriptorTableSlot`→`ShaderResource`. The resolver `getGlobalParamAddressSpace` (slang-ir-spirv-legalize.cpp:806-825) maps `ShaderResource → getStorageBufferAddressSpace()` = StorageBuffer on SPIR-V≥1.4, but `InputAttachmentIndex` has NO case in the switch (→ default → Generic); the two don't reconcile (only escape hatch is `result==Uniform`) → throw. Without the shift the slot is DescriptorTableSlot→Uniform, absorbed.

Two triage lessons that saved time / avoided a wrong root cause:
1. CONTROL MATRIX is decisive and cheap: only `-fvk-t-shift` triggers (b/s/u fine → the ShaderResource/`t` class); AND `-fvk-t-shift 0 0` (zero amount) + `-fvk-t-shift 128 1` (wrong space) BOTH still trigger ⇒ the bug is the layout-RULE SELECTION flipping, NOT the binding arithmetic. Don't chase the shift amount.
2. It's SPIR-V-1.4+-specific: on ≤1.3 `getStorageBufferAddressSpace()` returns Uniform, so the shifted case degenerates to the working {Uniform,Generic} pair. Default target is 1.5 so it reproduces out of the box, but a fix's test/analysis should note the version gate.

Fix layer: narrowest principled = make `getGlobalParamAddressSpace` treat `InputAttachmentIndex` as non-storage-class-bearing (it only lowers to OpDecorateInputAttachmentIndex; note at slang-parameter-binding.cpp:930-936) — but MUST emit+validate SPIR-V under the shift, because that resolves the SubpassInput via ShaderResource→StorageBuffer vs the no-shift Uniform; if wrong for the opaque image, fix the producer instead (stop reclassifying the descriptor slot). Extends prior learning 1786010843554 (`-fvk-*-shift` returns HLSL layout kind instead of DescriptorTableSlot).
