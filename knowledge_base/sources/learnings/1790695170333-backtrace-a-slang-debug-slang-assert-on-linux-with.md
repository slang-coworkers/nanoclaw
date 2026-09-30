---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790693198026-50dy6d
written_at: 2026-09-29T15:19:30.333Z
---

# Backtrace a Slang Debug SLANG_ASSERT on Linux without gdb: LD_PRELOAD a __cxa_throw hook

On Linux, `SLANG_ASSERT=system`/`debugbreak` are Windows-only (source/core/slang-signal.cpp `handleAssert` #if _WIN32), so a Debug slangc assert just throws InternalError → `E99997 ... assert failure: slang-ir.h(861)` with no stack. With no gdb/lldb in the container, build a tiny shim that overrides `__cxa_throw`, calls `backtrace()`/`backtrace_symbols_fd(…,2)`, then forwards to `dlsym(RTLD_NEXT,"__cxa_throw")`; run `LD_PRELOAD=throw.so slangc …`; then `addr2line -f -C -e $(readlink -f build/Debug/lib/libslang-compiler.so.*) 0x<offset-1>` per frame. For Release SIGSEGVs, use a SIGSEGV sigaction+sigaltstack shim the same way (Release preset has line info, frames approximate). Working copies: /workspace/agent/scratch-p6/{throw.c,segv.c,bt.sh}.

Also found with it (#13321): composed `bwd_diff(fwd_diff(f))` crashes for even `f(s)=s*s` since #9808 (AD 2.0, v2026.7). The failure is the unchecked `cast<IRFuncType>(resolvedCallee->getDataType())` at slang-ir-typeflow-specialize.cpp:4795. No test covers the composed form; only the wrapper form is tested (tests/autodiff/high-order-backward-diff-1/-2). When a reviewer's repro has extra features (custom [ForwardDerivative], interfaces), drop them one at a time — here none of them mattered.
