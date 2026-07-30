---
name: project-12182-cuda-optix-callable-rdc-linkage
description: PR
metadata: 
  node_type: memory
  type: project
  originSessionId: d48066a0-5d47-4266-ae79-573534644728
---

shader-slang/slang PR **#12182** "Add callable shader support to CUDA/OptiX backend" — author **ksavoie-nv**, branch `add-callshader-support-to-optix`, labeled `pr: breaking change` + `optix`. Human-contributor PR (not a bot chain).

**07-28:** Maintainer **jkwak-work** mentioned @nv-slang-bot (comment 5109886974) asking us to unroll ksavoie's self-declared blocker (comment 5093474096) — "sounds incomplete but I can't find any problems." Routed to **slang-fixer** as explanation-only (MODE=pr-review-fix, no fix). Fixer verified all claims against source at PR HEAD `574661e3` and posted a **review-style comment** (no verdict, no code): https://github.com/shader-slang/slang/pull/12182#issuecomment-5110036497

**The non-obvious gap (the answer to "what am I missing"):** the `static` multiple-definition guard in `slang-emit-cuda.cpp` keys off `m_entryPointStage`, which `slang-emit.cpp:2744-2752` collapses to `Stage::Unknown` whenever `getEntryPointCount()!=1`; `isRaytracingStage(Stage::Unknown)`=false (`slang-profile.cpp:209-222`). So for any multi-entry / whole-module `-target cuda` compile the duplicate-definition protection is **silently OFF** — invisible in every single-entry test. Labeled **reasoned-not-reproduced** (no local OptiX linker; confirmed only that protection is off + untested). Secondary: gate keys on stage not `-rdc`, so CUDA-*source* output over-applies `static` → cross-module helpers unresolvable unless `[CudaDeviceExport]` (the breaking change; `docs/cuda-target.md` uncovered). Tertiary: `tests/cuda/optix-exported-device-function.slang` CHECK-NOT passes vacuously.

**07-29 round 2:** ksavoie-nv replied (comment 5123651841) with 3 questions, explicitly asking @nv-slang-bot for doc-cited answers. Fixer posted citation-backed reply (https://github.com/shader-slang/slang/pull/12182#issuecomment-5123731343):
- **Q2 (is the self-`-rdc` cross-module-linking workflow supported?):** No documented contract in repo. CUDA documented only as NVRTC pass-through (`docs/cuda-target.md:31-35`); `-rdc` auto-added only for RayTracing pipeline (`slang-nvrtc-compiler.cpp:1341-1345`); no doc promises generated `__device__` helpers are externally linkable. → lowers Q1 stakes.
- **Q3 (`[CudaDeviceExport]` OK despite experimental?):** Genuinely experimental — `/// @experimental` at source of truth `core.meta.slang:4778-4781` + `4793-4796` alias (line #s at PR HEAD `574661e3`, NOT master where it's ~4803/4818). Reported as fact; not ruled on.
- **Q1 (silently add `static`?):** Left as jkwak's acceptability call; fixer contributed framing + deferred suggestion only.

Gotcha logged by fixer: **for a comment about a PR branch, cite PR-HEAD line numbers (permalinks), not working-tree/master** — line numbers drift; codex OUTPUT_REVIEW caught it.

**State:** Handed off — awaiting **jkwak-work**'s decisions: (Q1) is silently adding `static` acceptable; (implicit) is multi-entry-per-module OptiX compilation in scope; (Q3) is depending on an experimental attribute as the opt-out acceptable. If multi-entry supported → real correctness hole, gate must move off `m_entryPointStage` (scan module for any RT entry point, or thread explicit rdc/internal-linkage mode). Fixer offered to prototype the robust gate or a non-experimental opt-out on jkwak's word; holds thread `gh-issue-shader-slang/slang-12182` for the webhook reply.

**Why:** webhook-driven chains resurface in fresh sessions; this preserves the analysis so a jkwak reply doesn't force re-derivation.
