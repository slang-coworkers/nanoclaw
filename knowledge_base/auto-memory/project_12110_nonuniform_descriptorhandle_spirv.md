---
name: project_12110_nonuniform_descriptorhandle_spirv
description: "#12110 NonUniformResourceIndex dropped on DescriptorHandle/heap SPIR-V — triage root-cause CORRECTED; draft fix authorized"
metadata: 
  node_type: memory
  type: project
  originSessionId: e6be0f17-1845-4a29-809f-865fb7f85b6b
---

shader-slang/slang **#12110** — `NonUniformResourceIndex` dropped on the `DescriptorHandle<T>` / `ResourceDescriptorHeap[i]` / `SamplerDescriptorHeap[i]` SPIR-V path. Bot-filed **deliberate follow-up split from [[project_12051_descriptor_reuse_pinning]]** (NOT a dup). Correctness bug, medium/P2. HEAD verified a8874f6a1.

**Root cause CORRECTED vs issue body (dump-verified, 87-pass IR dump):** the issue body's hypothesis (wrapper stripped during handle specialization/inlining in `slang-ir-specialize-function-call.cpp`) is REFUTED — `nonUniformResourceIndex` count = 2 in every dumped pass. Peephole (:1220) also innocent. Real cause: `lowerDynamicResourceHeap` (slang-ir-lower-dynamic-resource-heap.cpp:48) buries the wrapper in a `makeVector(NUR(i),0)` round-trip; the SPIR-V float pass `processNonUniformResourceIndex` (slang-ir-float-non-uniform-resource-index.cpp ~242-388) has NO case for `MakeVector`/`CastUInt2ToDescriptorHandle`, so it can't bubble the wrapper to the `getElement` index → `propagateNonUniformDecorations` decorates nothing. Plain resource arrays preserve the decoration end-to-end.

**Scope SMALLER than issue implies** ("separate, larger change"): 2 missing float-pass switch cases (Approach A, RECOMMENDED — mirror MakeCombinedTextureSampler care so only the non-uniform component is decorated) OR producer tweak in lowerDynamicResourceHeap (Approach B). Approach C (peephole/emit special-case) REJECTED = consumer-side masking. GPU-less-testable (spirv-asm + FileCheck). Must cover BOTH `ResourceDescriptorHeap[NUR(i)]` and `.Handle = { uint2(NUR(i),0) }` spellings, with/without `spvDescriptorHeapEXT`. Documented tolerated gap at `tests/language-feature/descriptor-handle/desc-heap-nonuniform.slang:8-12`. Precedent: #6010 CLOSED / PR #6028 (Jan 2025) fixed the plain-array path.

**State (2026-07-15):** triage complete, verified verdict → GitHub (triager owns post). Draft fix authorized THROUGH slang-triager (fixer-edge owner) — Approach A, fall back B. DRAFT-only; ready/merge operator-gated. triage memo: inbox/a2a-1784083905656-cmltm6/triage-12110.md.
