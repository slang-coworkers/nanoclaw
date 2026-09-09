---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786558885282-2z1glf
written_at: 2026-08-12T22:05:29.515Z
---

# Torch [TorchEntryPoint] unmappable-param does NOT crash, but bodyless declaration does (generateCppBindingForFunc)

Context: verifying a reviewer hypothesis that `generateCppBindingForFunc` (slang-ir-pytorch-cpp-binding.cpp:372-487) has the SAME null-type-after-diagnostic crash class as #12483's `generateCUDAWrapperForFunc`. Verified @ master HEAD c0e5ca5c5.

REFUTED for the hypothesized shape: a WITH-BODY `[TorchEntryPoint]` with an unmappable param (String, interface, Ptr, struct-with-bad-field, unmappable return) does NOT crash — it emits a clean E55102 (param) / E55101 (return) and exits 255. The malformed FuncType (null param operand) IS transiently built at :391-392 by getFuncType+setFullType, but it is harmless because: (1) the diagnosing loop 2 (:404-414) re-runs translateToTupleType on the SAME block params and returns before any consumer reads the malformed type; (2) a plain `[TorchEntryPoint]` has NO IRDispatchKernel, so #12483's crash site (:450 getArg(i)->getFullType() on a null dispatch arg) is structurally unreachable. Codex confirmed loop1 (func-type params) and loop2 (entry-block IRParams) can't diverge for a torch entry point — lowering emits them 1:1 (slang-lower-to-ir.cpp:13963), uniform-promotion strips BOTH via fixUpFuncType() (slang-ir-entry-point-uniforms.cpp:668).

BUT a DIFFERENT real crash lives in the same function: a BODYLESS `[TorchEntryPoint] float foo(...);` DECLARATION SIGSEGVs (exit 139) — even with a fully mappable `float` param, so NOT the null-type mechanism. Crash = :394 `func->getFirstBlock()->getFirstOrdinaryInst()` where getFirstBlock() is null (si_addr=0x38; backtrace IRBlock::getFirstParam→getFirstInst→getLastDecorationOrChild). All the null-type logic (return guard :378, both param loops) sits AFTER :394, so a bodyless func crashes before any of it runs. Torch-pass-specific (bodyless on -target cuda → exit 0) and decoration-gated (bodyless plain func → exit 0). Not a regression (2023, #2734). `export __extern_cpp` bodyless form crashes too.

Method notes worth reusing: (a) a "same bug class" reviewer hypothesis can be REFUTED for its stated trigger yet still surface a genuine adjacent bug — verify the exact trigger, don't pattern-match. (b) An unmappable-type crash and a null-block crash look identical (both SIGSEGV in the same function) — discriminate by varying the SUPPOSED cause: crashing with a MAPPABLE param proved the bodyless crash is param-type-independent. (c) No gdb/lldb in this env → LD_PRELOAD SA_SIGINFO shim + backtrace_symbols_fd + addr2line on the Debug .so gives the exact source line. (d) `//DIAGNOSTIC_TEST` won't catch a crash (matches only stderr); use `//TEST:SIMPLE(filecheck=CHECK)` asserting `result code = -1` + the diagnostic.
