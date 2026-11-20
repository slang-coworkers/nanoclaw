---
type: triage
title: "Triage: shader-slang/slang#14569 — LLVM CPU: E41403 on RWStructuredBuffer<Atomic<T>> element atomics"
---
# Triage: shader-slang/slang#14569 — LLVM CPU target: atomics on RWStructuredBuffer<Atomic<T>> elements fail with E41403
Date: 2026-11-18 | Category: bug | Severity: medium | Priority: P2 | Component: IR (CPU resource lowering) / target-emit (LLVM CPU)

## What's broken
On `-emit-cpu-via-llvm`, an atomic on a `RWStructuredBuffer<Atomic<T>>` element is rejected
with E41403 "invalid atomic destination" as if the memory weren't device memory. `-target cpp`
accepts the same kernel; `uniform Atomic<T>*` and `groupshared` destinations pass validation on
LLVM and fail later at the emitter (E99997, #14191). So the validator — not the emitter — is
the only thing treating buffer elements differently on the CPU path.

## Repro (verified on master, build 2026.13.1-50-g3649fb982, Debug config)
```slang
RWStructuredBuffer<Atomic<uint>> counts;
[shader("compute")][numthreads(64,1,1)]
void main(uint3 t : SV_DispatchThreadID) { counts[t.x & 7].add(1u); }
```
`build/Debug/bin/slangc sb-atomic.slang -target llvm-host-ir -emit-cpu-via-llvm -whole-program -entry main -stage compute`
→ E41403. With `-target cpp` → compiles. Pointer form → E99997 (#14191). Groupshared form → E99997.
NOTE: this sandbox's Release build has no libslang-llvm.so (E00028); use the Debug build for LLVM repro.

## Root cause (verified file:line)
1. For CPU-via-LLVM, `lowerCPUResourceTypes` runs BEFORE `validateAtomicOperations`
   (source/slang/slang-emit.cpp:2404-2421) and rewrites
   `RWStructuredBufferGetElementPtr` into `GetOffsetPtr(FieldExtract(buffer, ptrKey), i)`
   (source/slang/slang-ir-lower-cpu-resource-types.cpp:154-159).
2. The lowered buffer struct's data field is created as `Ptr<T, access, AddressSpace::Generic, layout>`
   (slang-ir-lower-cpu-resource-types.cpp:93; same at :76 for ConstantBuffer/ParameterBlock and
   :112 for ByteAddressBuffer). `Generic` is a "will be specialized later" placeholder
   (core.meta.slang:1876-1878), but address-space specialization never runs for CPU targets
   (only GLSL/Metal/WGSL at slang-emit.cpp:2776-2788, SPIR-V at slang-ir-spirv-legalize.cpp:3043).
3. `isValidAtomicDest` (source/slang/slang-ir-validate.cpp:535-615) accepts
   `IRRWStructuredBufferGetElementPtr` unconditionally (:541) — but that op no longer exists on
   this path. The pointer-type switch (:556-562) accepts Global/GroupShared/StorageBuffer/
   UserPointer but not Generic; recursion (:607-612) covers GetElementPtr/GetOffsetPtr/
   FieldAddress but not FieldExtract. → false → E41403 (:636-639).
4. Why other forms pass: `-target cpp` doesn't run the lowering at all (op survives to :541);
   `uniform Atomic<uint>*` params get `Ptr`'s default address space Device = UserPointer
   (core.meta.slang:1456, slang-type-system-shared.h:172) → accepted at :561.

## Candidate approaches
### Approach A: produce `UserPointer` in the CPU resource lowering (RECOMMENDED)
- Where: slang-ir-lower-cpu-resource-types.cpp:76, :93, :112 — `AddressSpace::Generic` →
  `AddressSpace::UserPointer`.
- Behaviour delta: lowered buffer data pointers are typed as host-memory pointers; the
  `GetOffsetPtr` result inherits that ptr type, so validate.cpp:561 accepts it. Element atomics
  then fail at the known LLVM emitter gap (E99997, #14191) — identical to the pointer/groupshared
  forms, which is this issue's expected outcome ("destination recognised as device memory").
- Tradeoffs: 3-line producer-side fix at the root: on CPU, buffer storage IS host memory, and the
  pass's own header documents the lowering as plain `T* data` / `typealias LoweredType = T*`
  (slang-ir-lower-cpu-resource-types.cpp:10-28); a user `T*` defaults to UserPointer, so the
  Generic here was an accident, not a design choice. The LLVM emitter flattens all address spaces
  to opaque AS-0 pointers (slang-emit-llvm.cpp:289-305), so nothing downstream distinguishes them.
- Risk: low — no in-tree consumer of the Generic AS on the CPU path found (grep + DeepWiki found
  no dependency); fixer must confirm with the full tests/llvm + tests/cpu-program runs and the
  E41403 diagnostics tests (docs/generated/tests/design/cross-cutting/diagnostics-catalog/
  41403-invalid-atomic-destination-pointer.slang, tests/bugs/gh-6380-atomic-in-struct.slang).

### Approach B: teach `isValidAtomicDest` the CPU-lowered shape
- Where: slang-ir-validate.cpp:535-615 (recurse through IRFieldExtract, or accept Generic /
  plumb target awareness into the validator).
- Behaviour delta: validator learns the accidental shape.
- Tradeoffs: consumer-side patching (rejected per repo methodology); validator is shared across
  all targets, and Generic genuinely means "un-specialized/invalid" on GPU paths, so accepting it
  weakens the check elsewhere and needs target plumbing in a target-agnostic pass.
- Risk: masks the representation bug; grows a special case.

### Approach C: implement LLVM atomic emission (AtomicType lowering + kIROp_Atomic* in slang-emit-llvm.cpp)
- Out of scope: that is #14191. It does NOT fix E41403 on its own (validation rejects before
  emit), so it is complementary, not alternative. This issue = the validation gate.

## Recommended path
Approach A. Acceptance criteria:
1. The repro on `-target llvm-host-ir -emit-cpu-via-llvm -whole-program` (and
   `-target host-callable -emit-cpu-via-llvm`) no longer emits E41403; the destination is
   accepted and compilation proceeds to the E99997 LLVM-emitter gap (#14191), matching the
   pointer/groupshared forms.
2. Regression test asserting E41403 is gone (e.g. a CHECK/diagnostic-style test under
   tests/llvm/ — note tests/llvm/resource-type-lowering.slang is the natural home, but a full
   COMPARE_COMPUTE test needs #14191 first; a filecheck that E41403 is absent / that the error
   is the E99997 gap is the testable boundary today).
3. No behavior change on non-CPU targets (validator untouched); tests/llvm and
   tests/cpu-program suites pass.

## Sources
- Local code: slang-emit.cpp:2404-2421 (pass order), slang-ir-lower-cpu-resource-types.cpp
  (lowering + Generic ptrs), slang-ir-validate.cpp:535-639 (validator), slang-emit-llvm.cpp:289-305,
  :318-320, :2308-2309 (AS flattening; Atomic unsupported → E99997), core.meta.slang:1456, :1876-1878,
  slang-type-system-shared.h:120-173.
- Shared wiki: `slang-compiler-capability-check-scope-and-core-intrinsic-changes` (Atomic<T>
  extension methods escape the struct [require] — why .add reaches CPU at all, #14183 census),
  `slang-backends-spirv` (E41403 validator gate model, #11506/#13744/#13745 scope).
- Repro on master 2026.13.1-50-g3649fb982: E41403 (sb), E99997 (ptr + gs), pass (cpp). 2026-11-18.
- Related issues: #14191 (LLVM atomics emission — complementary), #14192 (Append/Consume E41403
  on LLVM — same validator, different synthesized ops), #14183/#14189 (CPU Atomic<T> capability gaps).
