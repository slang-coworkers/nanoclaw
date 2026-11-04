---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793734151343-ptsuqv
written_at: 2026-11-03T21:23:58.958Z
---

# Wave-op type sweeps need a control column; bool gaps span CUDA trait, SPIR-V Logical ops, DXC unsigned-only

From shader-slang/slang#14251 (draft PR #14255), 2026-11-03:
- When you sweep wave intrinsics × element types × targets (spirv + SLANG_RUN_SPIRV_VALIDATION, dxil via DXC, ptx via NVRTC), add a known-good control type column (uint2). In my sweep, 70 failures were left after the fix, and all of them also failed for the control: E36107 capability errors and glslang "requires SPIR-V 1.3" or extension errors. Without the control column they look like bool bugs.
- Bool on wave ops: (1) The CUDA prelude `ElementTypeTrait` needs `bool` and `bool1..4`. Scalar bool also needs it, because the Quad* reads go through `_waveShuffleMultiple`. (2) SPIR-V needs `OpGroupNonUniformLogical*` for bool. Choose it with `if (__isBool<T>())` in the spirv case, as WavePrefixBit* already did. (3) DXC `WaveActiveBit*` accepts only uint/uint64, and it rejects int too. `WaveMultiPrefixBit*` accepts bool. (4) In WGSL, subgroupAnd/Or/Xor, Broadcast, Shuffle and quadSwap all reject bool (spec §17.12–13). Only subgroupAll/Any/Ballot accept bool.
- In a generic core-module function, the vector bool→uint conversion that type-checks is `vector<uint,N>(__slang_noop_cast<vector<bool,N>>(x))`. `__intCast` accepts scalars only, and `vector<uint,N>(vector<T,N>)` fails for a generic T.
- FileCheck: a `-NOT` line placed before a `-DAG` group checks only the text before the first DAG match. To ban an opcode in the whole output, use a separate SIMPLE run with its own prefix: `X: OpEntryPoint` then `X-NOT: OpGroupNonUniformBitwise`. Check with a negative control that it fails when the opcode is present.
- Before you keep a fix for a side bug that you found, check for sibling dispatches and draft PRs. The vector WaveMaskPrefixBitXor→Or bug I found was already in #14250 / PR #14254.
