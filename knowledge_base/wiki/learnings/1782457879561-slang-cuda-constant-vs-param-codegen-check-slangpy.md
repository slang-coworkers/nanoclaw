---
title: "Slang CUDA: __constant__-vs-.param codegen check + slangpy-type repro substitution"
type: learning
topic: slang-compiler
source: learnings/1782457879561-slang-cuda-constant-vs-param-codegen-check-slangpy.md
---

# Slang CUDA: __constant__-vs-.param codegen check + slangpy-type repro substitution

From triaging shader-slang/slang#11774 (CUDA runtime-indexed resource arrays slow: kept in `.param` instead of `__constant__`).

**No-GPU discriminator for the CUDA entry-point-args vs ParameterBlock lowering.** You do NOT need a GPU to confirm this class of CUDA perf defect — it's a static codegen difference. Compile two variants with `slangc -target cuda -profile cs_6_0 -entry main` and grep the emitted `.cu`:
- Entry-point-args (uniforms as kernel params): kernel signature carries the by-value struct, e.g. `__global__ void main_0(ResList_0 rl_0, FixedArray<uint,16> tix_0, ...)` → lands in the `.param` bank → **0** `__constant__`. Slow serial `ld.param` chain for runtime-indexed resource arrays.
- `ParameterBlock<CallData>` wrapper: empty kernel `main_0()` + `extern "C" __constant__ GlobalParams_0 SLANG_globalParams;`. Emitted by `CUDASourceEmitter::emitParameterGroupImpl` (source/slang/slang-emit-cuda.cpp:410). Fast path (`ld.const` ptr + cached/broadcast `ld.global.nc`).
So `grep -c '__constant__ SLANG_globalParams' out.cu` is your fast/slow tell.

**`RWTensor<T,N>` is a SlangPy type, NOT core Slang.** A standalone `slangc` repro of a slangpy-originated issue using `RWTensor` fails with `undefined identifier 'RWTensor'` (it needs slangpy's modules on the include path). To reproduce the *mechanism* standalone, substitute a core resource type — `RWStructuredBuffer<float> bufs[N]` indexed at runtime reproduces the same "fixed-size resource array in an entry-point uniform → .param" shape. Be explicit in the verdict that you reproduced the mechanism with a substitute and did NOT re-run the perf benchmark (that needs the slangpy harness), so don't apply the `reproduced` label on a mechanism-only repro of a perf claim.

**Triage pattern — issue is a tracking issue for a COLLABORATOR's already-open PR.** Park the fix-forward (do NOT dispatch slang-fixer — a bot PR would duplicate/conflict with the human's). Still do everything else: HEAD-verify the claims, set Issue Type, post the 5-bullet verdict, and flag whether the linked PRs carry `Closes #N` (if not, the issue won't auto-close on merge — recommend the author add it). Report up to parent with route-to-review + the park decision, offering to forward if they disagree.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782457879561-slang-cuda-constant-vs-param-codegen-check-slangpy.md`_
