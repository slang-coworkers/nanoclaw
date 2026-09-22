---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790002248805-tucyxu
written_at: 2026-09-21T15:12:35.136Z
---

# Slang CUDA -capability cuda_sm_NN is not a usable arch selector (bounded, floored, linkWithOptions-inert)

When triaging CUDA/PTX target-selection issues (e.g. shader-slang/slang#13198, "select compute_120"), do NOT describe `-capability cuda_sm_NN` as a working target selector. Source-verified (HEAD 4233b2c) + empirically (local NVRTC 12.6, L40S):

1. **Bounded to predefined names, ceiling = 9.0.** The `_cuda_sm_*` atoms and public `cuda_sm_*` aliases are defined only for {1_0,2_0,3_0,3_5,4_0,5_0,6_0,7_0,8_0,8_9,9_0} (`slang-capabilities.capdef:248-258` / `:2230-2273`). There is no `cuda_sm_7_5`, `8_6`, `10_0`, or `12_0` → `findCapabilityName`/profile lookup returns Invalid → `error[E00014]: unknown profile`. `getCUDASMVersionForAtom()` (`slang-capability.cpp:86-115`) also caps at 9.0.

2. **Not an exact pin — it's a floor via max().** NVRTC arch = `max(NVRTC-version floor, requested capability version)` at `slang-nvrtc-compiler.cpp:1309-1347`. Floor: NVRTC≥12.8 → compute_75; 12.x → compute_50; 11.x → compute_35. So `-capability cuda_sm_1_0` emits `.target sm_50` on NVRTC 12.6 (floor raises it); `cuda_sm_7_0` → sm_75 on NVRTC 13.3 (floor 7.5) but sm_70 on 12.6 (floor 5.0). The requested cap only wins when it exceeds the NVRTC floor.

3. **Double `-arch` on -Xnvrtc.** Slang unconditionally appends its own `-arch=compute_NN`; a user's `-Xnvrtc --gpu-architecture=...` is appended AFTER with no de-dup (`slang-nvrtc-compiler.cpp:1382-1389`) → NVRTC sees the arch twice (13.3 warns "architecture X followed by Y"; 12.6 hard-errors "--gpu-architecture defined more than once").

4. **linkWithOptions() is inert for the arch.** `Capability(cuda_sm_9_0)` on `TargetDesc` emits sm_90, but supplied only via `linkWithOptions()` the default is unchanged — same class as the link-time-option-propagation gap tracked in #13197.

Net: there is no host-selectable newer-CUDA-target route today; supporting it needs Slang changes (new atoms — deferred in #12839 due to `.slang-module` serialized-ID compat, the reason #12842 only centralized the mapping — and/or a dedicated documented option + reject-don't-substitute + de-dup). GPU-free to reproduce the front-end + NVRTC-compile symptoms (no GPU execution needed).
