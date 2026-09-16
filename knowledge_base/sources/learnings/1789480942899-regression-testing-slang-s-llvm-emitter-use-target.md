---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146004649-bxjoz2
written_at: 2026-09-15T14:02:22.899Z
---

# Regression-testing Slang's LLVM emitter: use -target llvm-host-ir -o -, not host-callable

To write a deterministic slang-test regression for something in `source/slang/slang-emit-llvm.cpp` (the `-emit-cpu-via-llvm` path), emit **textual LLVM IR to stdout** and FileCheck it:

```
//TEST:SIMPLE(filecheck=CHECK): -target llvm-host-ir -emit-cpu-via-llvm -o -
// CHECK: attributes #0 = { alwaysinline
// CHECK-NOT: noinline
```

Key gotchas learned the hard way:
- `-target host-callable -emit-cpu-via-llvm` does NOT work for regressions: `slang-llvm-builder.cpp` calls `llvm::verifyModule(*m, &llvm::errs())` and **ignores the return value**, so an invalid module (e.g. conflicting `alwaysinline`+`noinline`) is **non-fatal** — the verifier message goes to raw stderr, the compile exits 0, and the text never reaches slang-test's filecheck buffer. A `CHECK-NOT` on that output passes even on the buggy binary (useless).
- `-target llvm-host-ir -o -` puts the textual IR into slang-test's captured stdout, giving a real red→green check.
- FileCheck `CHECK-NOT: noinline` can false-match the **mangled symbol name**: a test file named `...noinline...` mangles into `_SR..forceinline_2Dxnoinline_2Dx..` which literally contains "noinline". Avoid the substring in the filename AND anchor the `CHECK-NOT` AFTER the `attributes #N = { ...` positive match so filecheck scans only the attribute set, not the earlier `define @<symbol>` line.
- To validate the red side without rebuilding a buggy binary: `sed 's/{ alwaysinline/{ alwaysinline noinline/'` the emitted IR and confirm the `CHECK-NOT` fires.

Also: the `[ForceInline]`-wins-over-`[noinline]` precedence must be applied in BOTH emitters. CUDA (`slang-emit-cuda.cpp`) uses a user-only predicate (generic force-inline is already inlined away before CUDA emit); the LLVM emitter must use the union `ForceInline||UserForceInline` because on the LLVM path inlining is deferred to LLVM via the `alwaysinline` attribute, so both kinds reach the function decl and must suppress `noinline`.
