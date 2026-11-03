---
type: triage
title: "Triage: shader-slang/slang#14183 — CPU target: Atomic<float>::add -> E99999"
description: Atomic<T> extension methods escape the struct's [require]; C++ emitter only handles int AtomicAdd, all else E99999. Recommended B (emitter E55204 diag, non-breaking); A (gate) / C (real CPU atomics) are maintainer calls tied to #13705 part 2.
tags: [triage, cpu, cpp, prelude, atomics, capabilities]
---
# Triage: shader-slang/slang#14183 — CPU target: `Atomic<float>::add` -> internal error E99999
Date: 2026-11-02 | bug | medium | P2 | target-emit (C++/CPU) + core module | Duplicate: no

## What's broken
`Atomic<float>* pf; pf->add(1.0f);` with `-target cpp` -> `internal error[E99999]: unexpected IR opcode during code emit`.
Reporter wants either a float atomic add in the C++ prelude or a capability diagnostic (E36107-like), not an ICE.

## Repro (FACT, master 6815ed82d, Release build; freshness by timestamps — no source newer than the lib)
`slangc repro.slang -target cpp -o out.cpp` -> E99999 at 5:12. HLSL -> clean E55204 "floating point atomic operation"; CUDA/SPIR-V OK.
Old release 2026.13.1: identical -> NOT a regression.
Census (scratch-14183/census/, same for `uniform Atomic<T>*`, `RWStructuredBuffer<Atomic<T>>`, `groupshared Atomic<T>`; cpp == shader-sharedlib):
| Methods | Types | cpp | cuda |
|---|---|---|---|
| load/store/exchange/compareExchange | all | E36107 (clean) | OK |
| add | int/uint/int64/uint64 | OK (`_slang_atomic_add_*`) | OK |
| sub/min/max/and/or/xor/increment/decrement | int/uint/int64/uint64 | **E99999** | OK |
| add/sub/min/max | float/half/double | **E99999** | OK |
Runtime: int add on `-cpu` PASS; int sub/max and float add on `-cpu` E99999. CUDA float add runtime correct (4.0/6.0).
LLVM CPU targets (`-target llvm-ir`, `host-object-code`): E99997 "Unsupported instruction for LLVM target!" for **every** Atomic<T> add, int included.
IR at emit: `%41 : Float = atomicAdd(%40, 1 : Float, 0 : Int)` — `checkUnsupportedInst` (last pass) does not catch it.

## Codebase digest
- `source/slang/core.meta.slang:4188` `struct Atomic<T>` has `[require(cuda_glsl_hlsl_metal_spirv_wgsl)]` (capdef:430, no cpp/llvm). Members in the struct body (load/store/exchange/compareExchange) inherit it -> E36107 on cpp.
- `core.meta.slang:4223` `extension<T : IArithmeticAtomicable>` (add/sub/max/min + reduce*) and `:4304` `extension<T : IBitAtomicable>` (and/or/xor/increment/decrement) do NOT repeat the `[require]` -> pass capability check on cpp (`visitExtensionDecl` only checks the extension's own `[require]`, slang-check-decl.cpp:22793). Operators `+= -= &= |= ^= ++ --` (:4409–4458) call these. `reduce*` carry `[require(atomic_reduce)]` which includes cpp|llvm (capdef:2282).
- `source/slang/slang-emit-cpp.cpp:1367-1425` only atomic case: `kIROp_AtomicAdd`, switch on Int/UInt/Int64/UInt64 -> `_slang_atomic_add_{i,u}{32,64}`; `default: return false` (:1406) -> `defaultEmitInstStmt` -> `diagnoseUnhandledInst` (slang-emit-c-like.cpp:2474) = E99999. Its comment (:1376-1389) already documents the extension escape and that float "fails loudly".
- `prelude/slang-cpp-prelude.h:324-433` only `_slang_atomic_add_{u32,i32,u64,i64}` (MSVC `_InterlockedExchangeAdd*`, GCC/Clang `__atomic_fetch_add` RELAXED, else racy fallback). Added for `-trace-coverage` (#10886, 5ead59ffd; 64-bit #11451).
- `docs/cpu-target.md:18`: "Atomics are not supported in user code; the C++ backend implements only 32- and 64-bit integer atomic add, for compiler-generated code".
- HLSL precedent: `slang-emit-hlsl.cpp:742-747` `diagnoseFloatAtommic` -> `UnsupportedTargetIntrinsic` (E55204) for float AtomicAdd/Sub (:801, :819). Metal same (slang-emit-metal.cpp:454).
- CUDA (`slang-emit-cuda.cpp:763-904`) handles every atomic op and returns true, so a new diag in the CPP base does not reach CUDA (CUDASourceEmitter : CPPSourceEmitter).
- LLVM emitter: `slang-emit-llvm.cpp:315` "// TODO: atomics".
- Tests: none run Atomic<T> methods on -cpu/cpp.

## Candidate approaches
### A: Capability gate at the core module (producer)
- Where: add `[require(cuda_glsl_hlsl_metal_spirv_wgsl)]` to both extensions (core.meta.slang:4223, :4304) (+ the free operators if needed).
- Delta: all Atomic<T> methods -> E36107 on cpp/llvm, consistent with load/store and `InterlockedAdd` (#13705).
- Tradeoffs: one mechanism, principled layer. **Breaks `Atomic<int>.add` on CPU**, which works today (accidentally, but users may rely on it); interacts with `reduce*`' `atomic_reduce` (includes cpp) — needs a check that member require ⊄ parent doesn't error in the core-module build.
- Risk: behavior regression / breaking-change label; pre-empts the #13705 part-2 decision.
### B: Clean diagnostic in the C++ emitter (recommended)
- Where: `CPPSourceEmitter::tryEmitInstStmtImpl` slang-emit-cpp.cpp:1367-1407 — replace `default: return false` with an E55204 `UnsupportedTargetIntrinsic` (e.g. "floating point atomic add"), and add cases for AtomicSub/Min/Max/And/Or/Xor/Inc/Dec that diagnose the same way, emit a default-initialized result (`_emitInstAsDefaultInitializedVar`, as CUDA's coop-vec path) and return true.
- Delta: every E99999 -> clean E55204 at the user's source loc; int add unchanged; CUDA unaffected.
- Tradeoffs: smallest, non-breaking, mirrors HLSL/Metal. Emit-layer check (consumer-side) — justified because the supported set is type-dependent (int add yes, float no) inside one generic extension, which a capability cannot express, and HLSL/Metal already own the same check at this layer.
- Risk: low. Must not touch the coverage path (it emits int AtomicAdd, untouched).
- Optional same-PR: LLVM emitter E99997 -> clean diag (or leave as noted sibling).
### C: Real CPU atomics (feature)
- Where: prelude helpers for every op × {i32,u32,i64,u64,f32,f64} (`__atomic_fetch_{sub,and,or,xor}`, CAS loops for min/max and float add/sub/min/max; MSVC `_Interlocked*`), emitter cases, add cpp (and llvm, via LLVM `atomicrmw`/`cmpxchg`) to `Atomic<T>`'s `[require]`, update docs/cpu-target.md:18.
- Delta: reporter's kernel compiles and runs on CPU.
- Tradeoffs: largest; contradicts documented limitation; CAS-loop float min/max NaN/-0.0 traps (see wiki concept slang-backends-float-atomic-min-max, #14026/#14048); half has no CPU type (docs: float16_t unsupported).
- Risk: feature decision — same decision #13705 part 2 (D real support / E diagnostic / F docs) is parked on, owner = #13705 assignee.

## Recommended path (solution brief)
- **Hypothesis:** Atomic<T> extension methods escape the struct's `[require]`; the C++ emitter handles only int AtomicAdd, so every other op falls to `diagnoseUnhandledInst` (E99999).
- **Files:** slang-emit-cpp.cpp:1367-1407 (primary); slang-emit-hlsl.cpp:742 (pattern); core.meta.slang:4223/:4304 (context only).
- **Repro:** `build/Release/bin/slangc /workspace/agent/scratch-14183/repro.slang -target cpp -o out.cpp`; census script `/workspace/agent/scratch-14183/census.sh`.
- **Acceptance:** R1 no E99999 for any Atomic<T> method/type on `-target cpp`/`shader-sharedlib`/`-cpu` — each gives a user-located error naming the op. R2 `Atomic<int|uint|int64_t|uint64_t>.add` on CPU unchanged (add a `-cpu` COMPARE_COMPUTE test locking it). R3 CUDA/HLSL/SPIR-V output unchanged. R4 DIAGNOSTIC_TEST covering float add + int sub on cpp. R5 (optional) LLVM targets: clean diag instead of E99997, or note as sibling in the PR.
- **Recommended:** B — non-breaking, closes every ICE, keeps the A-vs-C choice open for the maintainer. Uncertain: a maintainer may prefer A (gate) — fixer should state the input-shape check (valid op, unsupported on target) in the PR.
- PR must say `Fixes #14183` only if it fully resolves the ICE ask; the prelude-float-add ask (C) stays a maintainer decision.

## Side findings (not acted on)
- HLSL: half/double pointer `Atomic<T>.add` emits `InterlockedAdd(...)` with no diag (HYPOTHESIS: invalid HLSL; dxc not run). Family of #14162/#14174.
- LLVM CPU targets ICE (E99997) for all Atomic<T> ops incl. int add.

## Sources
- DeepWiki Q1 (cpp atomic emit: only int AtomicAdd; prelude int-only), Q2 (float atomics gated in emitters, HLSL E55204; no cpp equivalent).
- Related: #13705 (CPU InterlockedAdd E36107; part 2 parked), #10683, #14026/PR #14048 (CUDA float min/max), #14162, #14173, #14174, #14175. Dup search: none.
- Shared wiki: slang-backends-float-atomic-min-max, slang-backends-cuda-cpp, learnings 1792162041270 (CPU user atomics unsupported), 1783706489119 (E99999 fallthrough).
