---
name: project_12278_cuda_samplercomparisonstate_undefined_prelude
description: "slang#12278 CUDA/PTX unused SamplerComparisonState emits undefined prelude type — triaged, parked (jkwak self-filed+self-assigned)"
metadata: 
  node_type: memory
  type: project
  originSessionId: e690ff83-7d16-4a42-97e8-3709cbee1d0a
---

# slang#12278 — [CUDA/PTX] Unused SamplerComparisonState emits undefined prelude type

Reporter **jkwak-work** (MEMBER), self-filed + self-assigned with a correct root-cause diagnosis. Webhook 2026-07-30.

**Bug:** A declared-but-unused `SamplerComparisonState` global is placed into the CUDA `GlobalParams` struct, but the shipped prelude (`prelude/slang-cuda-prelude.h:187-192`) defines only a dummy `SamplerState` (`struct SamplerStateUnused; typedef SamplerStateUnused* SamplerState;`) — no comparison counterpart. `-target cuda` "succeeds" emitting undefined-type code; `-target ptx` fails NVRTC with `identifier "SamplerComparisonState" is undefined`. Reproduces even with no comparison sampling in the entry point. Unbounded `SamplerComparisonState g_scmp[]` fails identically (emitted `Array<SamplerComparisonState>`).

**Root cause (CONFIRMED by triager):** `CUDASourceEmitter::calcTypeName` (`source/slang/slang-emit-cuda.cpp:388-390`) unconditionally emits literal `"SamplerComparisonState"` for `kIROp_SamplerComparisonStateType`. Asymmetry: unused plain `SamplerState` global is also placed in `GlobalParams` (no usage-DCE) but compiles because its dummy typedef backs it; the comparison variant has none.

**Triage verdict** (posted comment 5125053881; `reproduced` label; Issue Type=Bug; reproduced GPU-free @HEAD `6462d7d2f`, slangc Debug + nvcc 12.6): bug / medium / **P2** / target-emit (CUDA-PTX) + CUDA prelude. Not a dup.

**Recommended fix = Approach A** (one-line symmetric prelude typedef): `struct SamplerComparisonStateUnused; typedef SamplerComparisonStateUnused* SamplerComparisonState;`. Verified GPU-free (nvcc EXIT 2→0 scalar + unbounded-array). Scope caveat posted publicly: makes a declared/bound cmp-sampler a harmless no-op like SamplerState; does NOT implement SampleCmp on CUDA. Alts: B=CUDA diagnostic over-rejecting the harmless case (reporter's fallback); C=strip-unused rework (the TODO(JS), larger blast radius).

**State: PARKED-AT-TRIAGED. No fixer dispatched** — jkwak self-filed + self-assigned with correct diagnosis, so he drives per no-autofixer-on-self-filed+self-assigned rule. **RESUME → slang-fixer** only if he says "make a PR", links a PR, or another substantive human comment requests the fix.

Canonical thread: `gh-issue-shader-slang/slang-12278`.
