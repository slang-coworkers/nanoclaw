---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786580761031-f5dht9
written_at: 2026-08-14T13:41:27.238Z
---

# Bodyless-kernel SIGSEGV fix must gate before ALL pytorch/cuda passes, not per-site — sink has no dedup

Fixing shader-slang/slang#12515 (bodyless `[CudaKernel]` SIGSEGV). Per-site `isDefinition()` guards in `slang-ir-pytorch-cpp-binding.cpp` are INSUFFICIENT and a double-fire hazard:

1. **The reported repro spans multiple passes with no error-gate between them.** In `linkAndOptimizeIR` (slang-emit.cpp), for the CUDA/torch target family the crash-prone passes run as: `generateDerivativeWrappers` (:1382) → then later `generateHostFunctionsForAutoBindCuda` (:1524) → `lowerBuiltinTypesForKernelEntryPoints` (:1525) → `generatePyTorchCppBinding` (:1526) [torch] / `lowerBuiltinTypesForKernelEntryPoints` (:1531) [cuda]. `SLANG_PASS`/`wrapPass` runs each unconditionally — there is NO `getErrorCount()` gate between passes in a target's switch arm. So a `[TorchEntryPoint][CudaKernel]` bodyless decl on `-target torch` gets E-diagnosed by a `:1122` guard, then STILL SIGSEGVs at `generateCppBindingForFunc:394` (a DIFFERENT, unguarded site). Guarding one site just moves the crash.

2. **`DiagnosticSink` does NOT dedup** (`diagnoseImpl`, slang-diagnostic-sink.cpp:596 — just increments error count + writes). Two per-site guards on the same decl emit the SAME diagnostic twice.

3. **The idiomatic fix is a validation pass + error gate BEFORE the transform passes**, mirroring `diagnoseCircularConformances` (slang-emit.cpp:1412 + gate :1413): iterate funcs, diagnose bad ones, `if (sink->getErrorCount()!=0) return SLANG_FAIL;`. Downstream passes then assume the invariant and stay unguarded (no dead per-site checks, one source of truth, one diagnostic per decl).

4. **Scope hygiene via the decoration you check.** #12515's cells ALL carry `[CudaKernel]`; #12512/#12514 is `[TorchEntryPoint]`-ONLY; #12483 is a BODIED autobind kernel with an unmappable param. So validating "bodyless `[CudaKernel]`" fixes all of #12515 (incl. the `[TorchEntryPoint][CudaKernel]` cell, which has `[CudaKernel]`) WITHOUT overlapping #12514 or #12483. Restrict the pass to the CUDA/torch target family (`[CudaKernel]` on -target hlsl etc. must not be newly rejected).

Meta-lesson: when triage says "guard sites A,B,C", verify there isn't a site D on the SAME target path that a sibling unmerged PR was supposed to cover — an unmerged draft is not a dependency you can lean on. And test EVERY reported cell on EVERY reported target (I tested combined-attribute only on -target cuda, missed the -target torch crash; a codex CODE_REVIEW critique caught it).
