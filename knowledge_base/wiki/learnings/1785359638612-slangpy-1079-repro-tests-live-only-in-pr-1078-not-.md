---
title: "slangpy#1079 repro tests live only in PR #1078, not on main/CI branch"
type: learning
topic: slang-compiler
source: learnings/1785359638612-slangpy-1079-repro-tests-live-only-in-pr-1078-not-.md
---

# slangpy#1079 repro tests live only in PR #1078, not on main/CI branch

When planning/fixing slangpy#1079 (array-of-tensor Metal wrong-results + D3D12 device-removal): the four repro tests `test_array_of_{tensors_read, rwtensors_write, difftensors_read, rwdifftensors_write}` in `slangpy/tests/slangpy_tests/test_array.py` exist **ONLY on PR #1078's head** (branch `dev/slangpy-fixer/carrier-996`), NOT on `main` and NOT on the default CI checkout branch `ci/cap-gpu-test-workers`. To reproduce or extend, branch off PR #1078's head, not main.

The two pre-existing struct-array tests `test_vectorize_struct_with_tensor_array` (test_array.py:213) and `test_2d_mapped_vectorize_struct_with_tensor_array` (:247) DO exist on main; they currently `pytest.skip("Crash in the slang compiler")` on Metal citing slang#7606 — a CLOSED issue (the old crash). #1078 updates that skip reason to "wrong results" (a new, distinct defect, not the crash). So the skip is stale on main.

All triage file:line pointers for #1079 verified accurate at current HEAD (2026-07-29): tensor_zeros unconditional clear at src/slangpy_ext/func/tensor.cpp:442; Tensor.zeros default usage shader_resource|unordered_access at :841; D3D12 clear_buffer UAV requirement at external/slang-rhi/src/d3d12/d3d12-command.cpp:437/440/445; TensorMarshall writable-derivation at slangpy/builtin/tensor.py:184.

Correction to triage's Approach-C location: the BufferMarshall validation pattern to mirror is `BufferMarshall.resolve_dimensionality` in `slangpy/builtin/structuredbuffer.py:39-60` (checks `vector_target_type.writable and not has_ua` → raises ValueError). That check needs the RESOLVED target role, which is only available in the Tensor `resolve_dimensionality` path (tensorcommon.py:353-370), NOT at tensor.py:184 (__init__, where only the arg's own usage is known). So the clean-error guard belongs in tensorcommon.resolve_dimensionality, not create_tensor_marshall.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785359638612-slangpy-1079-repro-tests-live-only-in-pr-1078-not-.md`_
