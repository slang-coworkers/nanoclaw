---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786494321059-i7so09
written_at: 2026-08-12T18:11:55.964Z
---

# AutoPyBindCUDA null-deref-after-diagnostic: fix at producer, and a mirror gap in generateCppBindingForFunc

## Context
shader-slang/slang#12483 (draft PR #12508): `[AutoPyBindCUDA][CudaKernel] void k(String s)` compiled
`-target torch` emitted `error[E56001]` (String unmappable to a host type) then SIGSEGV'd (exit 139) —
a classic diagnose-then-crash / null-deref-after-diagnostic.

## Root cause + fix (in source/slang/slang-ir-pytorch-cpp-binding.cpp)
`generateCUDAWrapperForFunc` (~:1054) pushed the null return of `generateHostParamForCUDAParam` into
`mappedParams`, built an `IRDispatchKernel` with that null operand, and tagged the host func with
`IRTorchEntryPointDecoration`. Later `generatePyTorchCppBinding` → `generateCppBindingForFunc:450` did
`emitVar(arg->getFullType())` on the null operand → crash.

Fix = bail at the **producer**, not the consumer: on a null param mapping, `hostFunc->removeAndDeallocate()`
+ `return nullptr`. The removed func never gets the TorchEntryPoint decoration, so the decoration-keyed
binding worklist skips it. Add `SLANG_ASSERT(sink->getErrorCount() > 0)` at the bail — every null-return
path (generateHostParamForCUDAParam:812 guard; castHostToCUDAType:669-671 default that relies on
translateToHostType having diagnosed) implies a diagnostic, so the assert makes "diagnose-then-abort"
self-checking per CLAUDE.md's "assert the invariant / fail loudly" rule. Also defer `markTypeForPyExport`
to a post-loop pass so an abandoned wrapper adds no stray `IRPyExportDecoration` reflection roots.

## Non-obvious testing gotcha (cost me a review round)
For a crash-regression, `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` is INSUFFICIENT: `_diagnosticAnnotationTest`
(slang-test-main.cpp:841) matches only extracted stderr and ignores the result code. Use
`//TEST:SIMPLE(filecheck=CHECK)` and assert BOTH `result code = -1` and the `E56001` text — filecheck
validates the whole `getOutput` block. NOTE the subtlety: `result code = -1` does NOT by itself prove a
non-signal exit — on Unix `m_returnValue` inits to -1 and is only overwritten when `WIFEXITED`
(source/core/unix/slang-unix-process.cpp:103,126). The reason it's still a valid regression is that the
pre-fix crash FAILS the test in every spawn mode: in-process → runner dies (exit 139); `-use-test-server`
→ server subprocess killed → `JSON RPC failure: waitForResult()` → 0/1.

## Mirror gap — pre-existing, worth a follow-up
The SAME bug class is unfixed in the sibling `generateCppBindingForFunc` (:385-392): its first loop builds
a func type from `translateToTupleType` (returns null on an unrecognized type WITH NO diagnostic, :366-368)
and calls `setFullType` BEFORE the second loop (:408-413) diagnoses `InvalidTorchKernelParamType`. A
`[TorchEntryPoint]`-decorated function with an unmappable parameter could hit it. Not fixed in #12508
(out of scope). If you touch this file, consider guarding the first loop or merging the two redundant
`translateToTupleType` loops.
