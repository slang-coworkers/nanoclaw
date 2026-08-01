---
title: "slang-llvm.dll teardown AV = LLVM ManagedStatic/atexit callbacks survive FreeLibrary (Windows)"
type: learning
topic: slang-compiler
source: learnings/1785420752652-slang-llvm-dll-teardown-av-llvm-managedstatic-atex.md
---

# slang-llvm.dll teardown AV = LLVM ManagedStatic/atexit callbacks survive FreeLibrary (Windows)

**Symptom.** A `cpu`/host-callable slang-test (e.g. `gfx-smoke.slang`) prints all expected output, then crashes at
**process teardown** with `0xc0000005`; Windows Event Viewer names the faulting module **`slang-llvm.dll_unloaded`**
and the IP lands in the freed DLL's former address range with the stack in the Windows loader / CRT process-exit.
(shader-slang/slang#12292, HEAD 7c58a326b, jkwak self-filed+self-assigned.)

**Mechanism (code-grounded).** The slang-llvm plugin registers **process-global LLVM state** — `static
llvm::codegen::RegisterCodeGenFlags CGF;` (`source/slang-llvm/slang-llvm-builder.cpp:45`),
`cl::ParseCommandLineOptions` (`:523`), `InitializeAllTargets` (`:416`), `_initLLVM()`'s `InitializeNativeTarget*`
(`slang-llvm.cpp:480-495`) — all of which install `ManagedStatic`/atexit cleanup callbacks whose *code lives inside
slang-llvm.dll*. There is **no `llvm_shutdown()`/`llvm_shutdown_obj` anywhere under source/slang-llvm/**. On Windows
`SharedLibrary::unload()` is an unconditional `::FreeLibrary` (`source/core/slang-platform.cpp:176-180`). So the DLL is
unloaded while those global callbacks are still registered; at CRT exit they fire into unmapped memory → execute-AV.
Only reproduces in the **source-linked `SLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM`** config (default builds fetch a
prebuilt libslang-llvm), on Windows.

**Two traps to avoid (both cost me a wrong verdict if not caught):**
1. It is **NOT** a `Session` member / `ComPtr` destruction-order bug. A code-reader subagent proposed "reorder
   m_slangLLVM vs m_downstreamCompilerSet". That's wrong: (a) the declaration order makes m_slangLLVM (line 346) destroy
   *first* by reverse order anyway, and (b) the surviving callbacks are **process-global** and fire at CRT exit *after*
   the member sweep already FreeLibrary'd the DLL — no ComPtr ordering changes when process-global atexit runs. Reject
   member-reorder as a non-fix; verify the claimed destruction order against the actual header before repeating it.
2. It is distinct from the LLVM-teardown UAF fixed by PR #12114 (that was a *compile-time* DIBuilder/IRBuilder borrower
   UAF inside `generateJITLibrary()`, ASan-detected). Different phase, different mechanism.

**Fix directions.** (A, principled) explicit `llvm_shutdown()` at plugin teardown before unload — drains the
ManagedStatics while the DLL is still mapped. (B, low-risk) **pin the DLL**: there's an in-tree precedent — POSIX
`RTLD_NODELETE` for `libdxcompiler`/`libdxvk_*` marked "unclosable" (`slang-platform.cpp:237-249`, "invokes UB on
dlclose"); slang-llvm needs the same treatment plus a Windows equivalent (`GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_PIN,…)`
or skip FreeLibrary for pinned libs). Precedent shows the project already accepts pinning known-bad-on-unload libs.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785420752652-slang-llvm-dll-teardown-av-llvm-managedstatic-atex.md`_
