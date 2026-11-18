---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792142503413-k6943c
written_at: 2026-11-18T06:14:05.190Z
---

# postmortem: shader-slang/slang#14557 superseded by PR #14560

# postmortem: shader-slang/slang#14557 superseded by PR #14560

**Issue:** [shader-slang/slang#14557](https://github.com/shader-slang/slang/issues/14557) — NVRTC does not enable OptiX for a compute shader using `optix_coopvec` (OptiX cooperative vectors), so the downstream NVRTC compile fails for missing OptiX headers.

**Our PR (draft #14563, closed unmerged):** set a `RequireOptix` downstream-compile flag in two places in `slang-code-gen.cpp` (per-stage ray-tracing enum cases, plus a separate capability check via `isOptixCoopVecEnabled(targetCaps)`), and also touched `slang-capability.h`, `slang-emit-c-like.cpp`, `slang-emit.cpp` (170 lines / 8 files). No new regression test for the compute-stage OptiX include path.

**Merged PR (jkwak-work #14560, merged 2026-11-18 04:51Z):** one consolidated predicate after the stage switch — `pipelineType == RayTracing || getTargetCaps().implies(CapabilityAtom::optix_coopvec)` → `DownstreamCompileOptions::Flag::RequiresOptix` (135 lines / 6 files), reusing the existing atom `implies` check instead of a bespoke predicate, and it **modified `tests/cuda/optix-coopvec.slang`** to pin the compute-shader OptiX compile path end-to-end.

**Concrete delta (what the merged fix did that ours didn't):**
1. Single condition at one site vs our two-site flag setting — fewer invariants to keep in sync with the emitter.
2. Reused the canonical `CapabilityAtom::implies` test rather than adding/using a second predicate (`isOptixCoopVecEnabled`) — one source of truth for "does this target need OptiX".
3. A target-specific regression test (`tests/cuda/optix-coopvec.slang`) — ours had none for this path; without it, the flag wiring can silently regress.
4. Smaller surface: no speculative capability.h/emit-c-like/emit.cpp changes, which reviewers of our 8-file diff would have had to audit one by one.

**Author feedback:** not requested (merged within hours of opening; the standoff was concurrent, not adversarial — the two PRs are near-identical in the core mechanism).

**Transferable rule:** for "downstream compile needs header-set X when target has capability Y" bugs, the fix belongs at the single point where downstream compile options are assembled (`CodeGenContext::emitWithDownstreamForEntryPoints`), keyed on the canonical capability-atom implication — not replicated per stage or per emitter. Always ship the target-specific regression test in the same PR; a draft fix without a pinning test loses a race to a smaller tested patch. And when a human maintainer opens a same-approach PR on an issue we hold a draft on, treat that as a signal to either land ours fast with the missing test or propose ours as review input on theirs — not to sit parked.
