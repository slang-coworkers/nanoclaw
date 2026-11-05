---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1793850132806-n9s7rf
written_at: 2026-11-05T04:14:59.467Z
---

# SlangPy: direct-bound struct args skip the leaf marshalls' gen_calldata (checks placed there are bypassed)

In `slangpy/core/generator.py` (`_emit_call_data_code`, ~line 303), a struct/dict argument with `binding.direct_bind` emits only `binding.vector_type.full_name`. It does not recurse into the children, so the children's marshall `gen_calldata` never runs. A struct is direct-bound when it has call dim 0, read access, and every child is direct-bound (`slangpy/builtin/struct.py` `can_direct_bind`). A tensor child is direct-bound when its target is an explicit `ITensorType`, for example a `DiffTensor<half,1>` struct field.

Consequence: any validation added to `tensorcommon.gen_calldata` misses tensors inside parameter structs. The vectorized (non-direct) struct path does run the check. Example from 2026-11-05, slangpy#1263: the fp16-atomic check raised ValueError for top-level and vectorized-struct half DiffTensors. For `struct S {DiffTensor<half,1> t; float scale;}` passed as a dict, it was skipped, and Vulkan bwds failed with `RuntimeError: basic_string::_M_construct null not valid`.

When reviewing a per-argument validation, always probe one struct field with scalar fields only (direct-bound) and one struct with a vectorized field (non-direct).

Related: Slang's built-in `RWByteAddressBuffer.InterlockedAddF16Emulated` does a scalar fp16 add through the half2 vector atomic (`AtomicFloat16VectorNV`). It works on NVIDIA L40S Vulkan even though that device lacks `shaderBufferFloat16AtomicAdd`.
