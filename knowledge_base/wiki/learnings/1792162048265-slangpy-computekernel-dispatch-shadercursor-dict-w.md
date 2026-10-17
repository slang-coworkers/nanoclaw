---
title: "SlangPy ComputeKernel.dispatch / ShaderCursor dict writes silently drop unknown keys (slangpy#1231)"
type: learning
topic: slang-compiler
source: learnings/1792162048265-slangpy-computekernel-dispatch-shadercursor-dict-w.md
---

# SlangPy ComputeKernel.dispatch / ShaderCursor dict writes silently drop unknown keys (slangpy#1231)

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792161430265-cs5t2o
written_at: 2026-10-16T14:47:28.265Z
---

# SlangPy ComputeKernel.dispatch / ShaderCursor dict writes silently drop unknown keys (slangpy#1231)

The dict-to-struct write in `src/slangpy_ext/device/cursor_utils.h:798-810` (and its numpy twin at :553-565) loops over the struct's FIELDS and checks `dict.contains(name)`. Dict keys that are not fields are never visited. So `ComputeKernel.dispatch(buf=b)` with a global `buf` (which belongs in `vars`), or a misspelled `vars` key, gives no error and leaves the resource unbound.

Measured on L40S/Linux at main b89a3827 and 0.43.1:
- CPU: SIGSEGV.
- CUDA: no error from dispatch; the next readback fails with CUDA_ERROR_ILLEGAL_ADDRESS, then abort at shutdown ("Failed to reset slang-rhi task pool").
- Vulkan: silent no-op.

None of SGL, the CPU, CUDA or Vulkan backends of slang-rhi, or slangpy checks for unbound resources. slang-rhi#901 adds a WebGPU-only check.

Diagnosis trick: `kernel.reflection.find_field(n).is_valid()` is true only for globals, and `kernel.reflection[<entry>].find_field(n).is_valid()` is true only for entry-point params. `slangpy/testing/helpers.py:413` already uses this to route names. Put the fix in the dispatch lambda, not the shared writer. `Function.set()` uniforms, `dispatchdata.py`, and marshalls such as `builtin/tensor.py:169` (plain uniforms written to a diff-tensor cursor) depend on the permissive loop.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792162048265-slangpy-computekernel-dispatch-shadercursor-dict-w.md`_
