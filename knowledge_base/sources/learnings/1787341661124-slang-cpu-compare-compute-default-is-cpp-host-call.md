---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787213748798-jxemqv
written_at: 2026-08-21T19:47:41.124Z
---

# Slang -cpu COMPARE_COMPUTE default is CPP host-callable, not LLVM — a real fast-path oracle

When a Slang IR pass gates on `isCPUTarget && !isCPUTargetViaLLVM` (e.g. the #12642 AnyValue bulk-copy fast path), a `//TEST:COMPARE_COMPUTE_EX(...):-cpu` test DOES exercise that path at runtime. `isCPUTargetViaLLVM` (source/slang/slang-type-layout.cpp:3309) returns true only for HostLLVMIR/ShaderLLVMIR/HostObjectCode, OR for the host-callable targets when EmitCPUMethod==SLANG_EMIT_CPU_VIA_LLVM (2). The default is SLANG_EMIT_CPU_DEFAULT (0), so `-cpu` compute compiles emitted C++ via the host compiler through the CPP source emitter — the predicate accepts, the fast path fires, and the CPU round-trip is a genuine correctness oracle. So a reviewer flag like Devin's "CPU correctness test may not exercise the fast path" is refutable by this fact, not merely a maybe.

Separately, `SLANG_HOST_VM` classifies as `isCPUTarget()==true` (SLANG_HOST_VM→ObjectCode/UniversalCPU in slang-artifact-desc-util.cpp:333; UniversalCPU→CPULike) and `isCPUTargetViaLLVM(HostVM)==false` (HostVM falls to the switch default). So `(isCUDATarget||isCPUTarget)&&!isCPUTargetViaLLVM` ALSO matches HostVM/slangi — which has no textual `slang_bit_cast` prelude. Any gate whose comment says "C-family SOURCE emitters only" is inaccurate unless it also excludes HostVM. generateAnyValueMarshallingFunctions (slang-emit.cpp:1663) runs BEFORE the HostVM early-return (:1669), so such a fast path does fire on the bytecode VM.

Also: a `kIROp_BitCast` a pass creates may be silently decomposed field-wise by `lowerBitCast`. `requiredLoweringPassSet.bitcast` is set by ANY BitCast in the module at the calcRequiredLoweringPassSet scan (emit.cpp:535); there is NO rescan between that scan (:1519) and lowerBitCast (:2453); processBitCast (slang-ir-lower-bit-cast.cpp:236-395) exempts direct-SPIRV but NOT CUDA/CPP source → aggregate cast falls to readObject (:392) field-wise. So an optimization emitting a whole-object bitcast can be negated by an unrelated bitcast elsewhere in the module — and any FileCheck assertion on the `slang_bit_cast<T>` emit-form is fragile to that.
