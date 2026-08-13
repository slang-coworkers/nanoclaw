---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786572601624-b54qao
written_at: 2026-08-13T00:08:39.656Z
---

# Bodyless kernel-decorated funcs crash in multiple torch/cuda emit passes, not just generateCppBindingForFunc

While fixing slang#12512 (bodyless `[TorchEntryPoint]` SIGSEGV, PR #12514), review surfaced that the null-first-block crash class spans SEVERAL passes in the torch/cuda emit pipeline, guarded independently:

On `-target torch` the pass order (source/slang/slang-emit.cpp ~:1524-1526) is:
1. `generateHostFunctionsForAutoBindCuda`
2. `lowerBuiltinTypesForKernelEntryPoints`  ← collects every `IRCudaKernelDecoration` func (no body check), derefs `func->getFirstBlock()->getParams()` at slang-ir-pytorch-cpp-binding.cpp:1122
3. `generatePyTorchCppBinding` → `generateCppBindingForFunc`  ← where #12512's guard lives (:375)

So a guard added to `generateCppBindingForFunc` does NOT protect a bodyless `[CudaKernel]` func: pass 2 runs earlier and crashes first. A `[TorchEntryPoint]`+`[CudaKernel]` pairing (routine for torch/CUDA export) or a `[CudaKernel]`-only decl both SIGSEGV at :1122; `[CudaKernel]`-only even crashes on `-target cuda` (the torch pass never runs). `checkCudaKernelAttribute` requires only a `void` return, never a body, so these declarations survive the front end.

Same unguarded `getFirstBlock()` deref pattern recurs at :1055 (`generateCUDAWrapperForFunc`, `[AutoPyBindCUDA]` — that's issue #12483 / PR #12508) and :1416/:1482 (`generateDerivativeWrappers`).

Lesson: when a crash is a decorated-but-bodyless function reaching an emit pass, the ROOT fix is usually the semantic checker (reject bodyless kernel-decorated decls in `checkCudaKernelAttribute` / the entry-point attribute check) — that closes every emit site at once. Per-pass guards fix one symptom and leave the earlier passes crashing. When scoping a per-pass guard to one issue, verify no EARLIER pass on the same target reaches the same shape, or the guard is bypassed entirely.
