---
name: project_12073_float3_swizzle_base_reeval
description: IN-FLIGHT
metadata: 
  node_type: memory
  type: project
  originSessionId: 9e45fd10-83bf-4fc5-add9-e325929c4585
---

**shader-slang/slang#12073** — CUDA + CPU/C++ targets re-evaluate a multi-component swizzle's base once per component. When the base is a folded value (texture fetch / buffer load), the fetch is textually duplicated N times → ~3x memory traffic for `.rgb`. SPIR-V (`OpVectorShuffle`) and HLSL (native `.xyz`) evaluate base once → no penalty. Output is correct; this is a **perf/codegen** bug, not correctness or layout.

**Escalated from** shader-slang/slangpy#1059 (`float3` loop math ~2.9x slower than `float4` on CUDA). SlangPy is type-transparent and can't fix — lowering lives in the compiler. Issue #12073 was auto-filed by nv-slang-bot.

**Root cause CONFIRMED (triager-validated, not just relayed):** `CPPSourceEmitter::kIROp_Swizzle` override (`source/slang/slang-emit-cpp.cpp:1692-1716`) re-emits the base via `emitOperand` inside the per-component brace-init loop, and `shouldFoldInstIntoUseSites` folds the load/fetch into each use site. `CUDASourceEmitter : CPPSourceEmitter` (`slang-emit-cuda.h:44`) inherits it. GPU-free repro: CUDA `tex2Dfetch` hot-loop count 1/3/1 for `f4_all`/`f3_loop`/`f3_epi` at HEAD `8f0c3515d`; CPP duplicates `src[q]` subscript 3×.

**Classification:** bug(perf) / medium / target-emit (CUDA·CPP) / P2 · no dup.

**Recommended fix (triager):** extend the existing `CPPSourceEmitter::shouldFoldInstIntoUseSites` vector guard (`emit-cpp.cpp:1943-1951`, already refuses folding for reshape/cast "multiple references") to also refuse folding `kIROp_Swizzle` with `elementCount>1` → base materializes as a temp → CUDA/CPP reach SPIR-V/HLSL parity. GPU-free FileCheck test feasible.

**Chain state (07-13):** triaged & REPRODUCED, verdict posted on issue (comment 4953942759), forwarded to slang-fixer (peer-wired via triager — do NOT double-dispatch). Fixer expected to open a DRAFT PR per drafts-only guardrail [[feedback_drafts_only_guardrail]]. Await fixer report. Sibling/cross-ref: slangpy#1059 (downstream, closes when compiler fix lands).
