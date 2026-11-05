---
title: "SlangPy: new Slang scalar types (BFloat16=16, FP8=17/18) break SGL ScalarType — adding a torch dtype entry is not enough"
type: learning
topic: slang-compiler
source: learnings/1793838976078-slangpy-new-slang-scalar-types-bfloat16-16-fp8-17-.md
---

# SlangPy: new Slang scalar types (BFloat16=16, FP8=17/18) break SGL ScalarType — adding a torch dtype entry is not enough

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793837912159-6y7ocu
written_at: 2026-11-05T00:36:16.078Z
---

# SlangPy: new Slang scalar types (BFloat16=16, FP8=17/18) break SGL ScalarType — adding a torch dtype entry is not enough

slangpy#1260 (2026-11-05, main 68d1e782, Slang 2026.20). SGL `TypeReflection::ScalarType` (src/sgl/device/reflection.h:426) stops at uintptr=15, with `COUNT`=16. Slang's `SLANG_SCALAR_TYPE_BFLOAT16` is 16, and `FLOAT_E4M3`/`FLOAT_E5M2` are 17/18.

Consequences:
- **Python reads raise.** The nanobind enum is not a flag enum, so every `.scalar_type` / `slang_scalar_type` read on a BFloat16 reflection raises `ValueError: 16 is not a valid ScalarType`. This hits the torch return path, value.py and jupyter.py. A Python-only torch dtype mapping cannot work.
- **C++ reads go out of bounds.** The read/write converter tables in src/slangpy_ext/device/cursor_utils.h are sized `[COUNT]` and indexed by the raw scalar value without a bounds check. Value 16+ reads past the end (UB); here it happened to land on a neighbouring error handler.
- **The checklist is incomplete.** The repo's "Adding a new torch dtype" checklist (.github/instructions/torchintegration.instructions.md:143) also misses these: the SGL enum + SGL_ENUM_INFO, DataType, `scalar_type_name` (src/sgl/refl/type.cpp:144), `get_scalar_type_cpu_size`, and `scalartype_to_dtype` (src/slangpy_ext/func/tensor.cpp:17).

What already works: the torch bridge has had bf16 code 15 since PR #814. BFloat16 kernels run bit-exact on L40S CUDA and Vulkan with SlangPy-allocated tensors (Vulkan auto-adds spvBFloat16KHR).

Separate tooling gotcha: the gate-chain-routing hook rejects a `[Triage handoff]` send_message to the fixer unless `in_reply_to` is set. Use the parent's dispatch message id along with the explicit `to` and `thread_id`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793838976078-slangpy-new-slang-scalar-types-bfloat16-16-fp8-17-.md`_
