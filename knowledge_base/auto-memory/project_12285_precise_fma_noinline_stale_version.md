---
name: project_12285_precise_fma_noinline_stale_version
description: "slang#12285 precise FMA compensated-sum wrong unless noinline — stale-version dup of"
metadata: 
  node_type: memory
  type: project
  originSessionId: 04a03e1f-29f2-49e9-806a-649c4ec6a031
---

shader-slang/slang **#12285** (ccummingsNV): Neumaier compensated-summation shader under `SlangFloatingPointMode.precise` returns wrong result on Vulkan (GB300, driver 610.43.02) when correction helper is **inlined**; `[noinline]` fixes it (function-call boundary = driver optimization barrier). CUDA correct both ways. Symptom: emitted SPIR-V had `OpFAdd`→`GLSL.std.450 Fma`→`OpFAdd` but **0 `NoContraction`** decorations.

**Verdict (triage, 2026-07-30): stale-version report — already fixed upstream. No fixer, no new track, chain CLOSED.**
- Root cause = manifestation of CLOSED **#11933**, fixed by **PR #11935 / commit `33f9ed0c`** (2026-07-07), first shipped **v2026.13**. Reporter on **2026.12** (cut 2026-06-25, before fix).
- Verified locally @HEAD `7c58a326b`: reporter's exact `repro.slang` → their 2026.12 capture = 0 NoContraction module-wide; top-of-tree = **32 NoContraction** on byte-identical instruction graph, decorating the exact add the driver was miscontracting.
- **NOT a fold into [[project_12198_precise_qualifier_spirv_nocontraction]].** #12285 uses **global `-fp-mode precise`** (owned by #11933/#11935). #12198 = per-**variable** `precise` **qualifier** in **default** fp-mode (still open). Keep the distinction: global fp-mode precise vs per-variable precise qualifier are different code paths.
- Parent's "inlining drops the decoration" hypothesis **refuted**: fp-mode is target-scoped; only per-function override producer is autodiff, which only sets `Fast`. In 2026.12 decoration was globally never emitted → inlining irrelevant.
- GitHub: 5-bullet verdict posted (comment 5130968682), Type=Bug, asked MEMBER reporter to re-test ≥v2026.13. No `reproduced`/`regression` labels (symptom does NOT repro at HEAD; precise-SPIR-V never worked pre-#11935 so the fix *added* it, not a regression). Honest hedge: verified compiler symptom not GB300 runtime; residual wrong-result on 2026.13+ = downstream NVIDIA driver question.
- Triager memo: `/workspace/agent/memory/triage-12285.md`. RE-OPEN only on substantive human reply.
