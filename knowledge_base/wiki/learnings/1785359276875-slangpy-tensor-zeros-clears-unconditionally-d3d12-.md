---
title: "SlangPy Tensor.zeros clears unconditionally — D3D12 device loss on shader_resource-only tensors"
type: learning
topic: slang-compiler
source: learnings/1785359276875-slangpy-tensor-zeros-clears-unconditionally-d3d12-.md
---

# SlangPy Tensor.zeros clears unconditionally — D3D12 device loss on shader_resource-only tensors

**Finding (verified by source read, slangpy#1079):** `Tensor.zeros(...)` clears its backing buffer *unconditionally at creation* — `tensor_zeros()` calls `tensor->clear()` at `src/slangpy_ext/func/tensor.cpp:442` regardless of the `usage` flag passed in.

**Why it bites D3D12 specifically:** `Tensor::clear()` (`src/sgl/func/tensor.cpp:412`) → `cmd->clear_buffer(m_storage)`. The D3D12 RHI `clear_buffer` (`external/slang-rhi/src/d3d12/d3d12-command.cpp:437-445`) **requires `ResourceState::UnorderedAccess` and creates a UAV** (`getUAV(Format::R32Uint)` → `ClearUnorderedAccessViewUint`). If the buffer was created `shader_resource`-only (no `unordered_access`), `CreateUnorderedAccessView` fails → `RemoveDevice` (DXGI_ERROR_INVALID_CALL), which poisons the whole shared D3D12 device/worker. Vulkan & CUDA clear via transfer ops (no UAV requirement) so they silently pass.

**Why it's narrow, not pervasive:** `Tensor.zeros` defaults `usage = shader_resource | unordered_access` (tensor.cpp:841), so normal zeros are UAV-capable and clear fine. Only an explicit `usage=BufferUsage.shader_resource` override trips it. Raw `device.create_buffer(usage=shader_resource)` does NOT hit this path — only the `Tensor.zeros/zeros_like` path calls `tensor_zeros→clear`.

**Robustness gap:** `TensorMarshall.__init__` (`slangpy/builtin/tensor.py:180-187`) derives `writable` from the usage flag silently, with no validation — unlike `BufferMarshall.resolve_dimensionality`, which DOES raise `ValueError` when a writable buffer lacks UAV. A usage/role mismatch on a tensor should raise a clean `SlangPyError` before any GPU clear rather than removing the device.

**Takeaway for whoever hits "D3D12 device removed / RemoveDevice / closed command list" cascades in SlangPy tests:** check whether a `shader_resource`-only tensor is being cleared (created via `Tensor.zeros`/`zeros_like`, or grad buffers). The mechanism is clear-on-non-UAV, and it can manifest at Tensor *creation*, not necessarily at dispatch — despite error narratives that blame dispatch.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785359276875-slangpy-tensor-zeros-clears-unconditionally-d3d12-.md`_
