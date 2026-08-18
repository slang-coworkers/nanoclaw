---
title: "slangpy #1080 Tensor::clear copy-path: copy_destination guaranteed only for device_local; UAV-clear is D3D12-specific"
type: learning
topic: slang-compiler
source: learnings/1785365827665-slangpy-1080-tensor-clear-copy-path-copy-destinati.md
---

# slangpy #1080 Tensor::clear copy-path: copy_destination guaranteed only for device_local; UAV-clear is D3D12-specific

Reviewing slangpy PR #1080 (fix for #1079 D3D12 device removal). The fix routes non-UAV `Tensor::clear()` through a copy-path upload (`cmd->upload_buffer_data` or `set_data`) instead of `clear_buffer`. Two verified facts a reviewer/fixer needs:

**1. copy_destination is guaranteed ONLY for `device_local` storage.** `Buffer` ctor unconditionally injects `CopySource | CopyDestination` — but keyed on `memory_type == device_local` (`src/sgl/device/resource.cpp:121-122`), NOT on the caller's `usage`. So a `usage=shader_resource`-only tensor still gets copy_destination *iff* it is device_local (the factory default). The copy-path fix is therefore provably safe on the default path — it does NOT trade the D3D12 RemoveDevice for a copy failure.

**2. The UAV requirement that caused #1079 is D3D12-SPECIFIC — verify before assuming a uniform divert is safe.** All four backend `cmdClearBuffer` impls differ:
- D3D12: requires `ResourceState::UnorderedAccess` + creates a UAV → RemoveDevice on a non-UAV buffer (`external/slang-rhi/src/d3d12/d3d12-command.cpp:437`). ← the bug.
- Vulkan: requires only `CopyDestination` + `vkCmdFillBuffer` (`vulkan/vk-command.cpp:374,389`).
- Metal: blit `fillBuffer` (`metal/metal-command.cpp:307-312`).
- CUDA: `cuMemsetD32` on raw pointer, NO usage requirement (`cuda/cuda-command.cpp:495`).

Consequence: a guard keyed on `unordered_access` alone (not `memory_type`) introduces a cross-backend behaviour change for non-`device_local` storage. `Buffer::set_data` dispatches by memory_type (`resource.cpp:180-195`): device_local→upload_buffer_data (ok), upload→map+memcpy (ok), **read_back→THROWS** "Cannot write data to buffer with memory type 'read_back'". So clearing a non-UAV `read_back` tensor now throws where CUDA/Metal previously succeeded via `clear_buffer`. It's unreachable on the default path (factories default `usage=shader_resource|unordered_access`, `memory_type=device_local`) and fails safe (clean exception), so should-change not blocker — but don't claim "uniform divert has no regression" without checking memory_type.

**3. Lifetime is safe in the `cmd!=nullptr` branch** even though the local zero-vector dies when clear() returns: `CommandEncoder::uploadBufferData` stages the host bytes via `memcpy` into an upload heap at RECORD time and retains the handle (`external/slang-rhi/src/command-buffer.cpp:682` → `staging-heap.cpp:126`). No use-after-free.

Meta-learning: when a fix says "divert all backends uniformly to avoid a D3D12-only failure", verify the *other* backends' primitive requirements — the failing op may be more permissive elsewhere, so the divert can regress a path that previously worked.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785365827665-slangpy-1080-tensor-clear-copy-path-copy-destinati.md`_
