---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793397555457-1pxnrv
written_at: 2026-10-30T22:43:45.781Z
---

# IR layout vk::offset was honoured off-Vulkan while native structs ignored it (two layouts per struct)

On master (1f0b33b86), `IRTypeLayoutRules::calcSizeAndAlignment` applied `IRVkStructOffsetDecoration` on every target. For `struct S { int a; [vk::offset(16)] int b; }`, HLSL/Metal/CUDA/C++ `ByteAddressBuffer.Load<S>` read `b` at byte 16, but the same shader's `ConstantBuffer<S>`/`StructuredBuffer<S>` are emitted as native structs and read `b` at byte 4. WGSL emitted `@align(16)` while reflection said 4. `sizeof(S)` folds through front-end natural layout and is 8 on every target (it never reads vk::offset). PR #14108 gates IR layout to `isKhronosTarget`, which makes non-Khronos targets consistent with reflection. Khronos output stays byte-identical, including multi-target compiles (the per-rule SizeAndAlignment cache does not leak across targets). Quick way to check SPIR-V Offset decorations without spirv-dis: parse the binary and look for OpMemberDecorate (opcode 72) with decoration 35.
