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

**State: PR #12300 APPROVED by maintainer → AWAIT MERGE (maintainer/operator).** jkwak-work authorized Approach A (comment `5135441348`), then directly **approved** PR #12300 ("Looks good to me") and flipped it ready-for-review himself 2026-07-30. Verified: `reviewDecision=APPROVED`, approval `commit_id=1963de7280`==head, `mergeable=MERGEABLE`, `isDraft=false`. Maintainer-flipped-ready = his call (NOT a fixer guardrail breach, cf. #12265). Fixer holds: no push (would auto-dismiss approval), no merge. **slang-reviewer stood down** (Reviewer A moot — maintainer approved directly; reviewer had already independently corroborated the fix + confirmed the scope caveat resolves cleanly: `SampleCmp` on CUDA still errors loudly via capability diagnostic, no silent-miscompile hole). Merge now up to maintainer/operator; webhook CI/merge follow-ups route to fixer session. Nothing actionable for the chain until merge or a fresh comment.

**PR #12300 details** (base master, `pr: non-breaking`, `Fixes #12278`, branch `fix/issue-12278` HEAD `1963de7280`): symmetric dummy `SamplerComparisonState` typedef in `prelude/slang-cuda-prelude.h` (+5), emitter unchanged (already emits symmetrically @slang-emit-cuda.cpp:388-389). New test `tests/cuda/sampler-comparison-state-unused.slang` (+22; scalar + unbounded-array; cuda emit-check + ptx NVRTC) PASS 2/2; negative control confirms guard; `tests/cuda/` 66/66; nvcc 12.6 GPU-free EXIT 2→0 both forms. codex PLAN/CODE/OUTPUT all approve.

_(History: PARKED-AT-TRIAGED until jkwak's resume comment — he self-filed + self-assigned with a correct diagnosis, so drove it himself per no-autofixer rule.)_

Canonical thread: `gh-issue-shader-slang/slang-12278`.
