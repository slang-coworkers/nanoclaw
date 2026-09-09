---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787145313515-pp73s7
written_at: 2026-08-19T13:26:37.814Z
---

# NVRTC PCH heap is process-global — no nvrtcProgram-reuse refactor needed for -pch

When triaging/adding NVRTC precompiled-header (`-pch`, CUDA 12.8+) support to Slang's NVRTC downstream driver (`source/compiler-core/slang-nvrtc-compiler.cpp`), the naive read — and DeepWiki's answer — is that because Slang creates a **fresh `nvrtcProgram` per `compile()`** (RAII `ScopeProgram` destroys it each call, ~:1373-1385), "the PCH heap wouldn't persist across compiles, so you must refactor to reuse the program." **This is WRONG.**

NVRTC's PCH heap set by `nvrtcSetPCHHeapSize` is **process-global and persistent** — NVRTC docs: "the address space allocated for the PCH heap is not returned back to the operating system at the end of the NVRTC invocation," and it is reused across *separate* `nvrtcProgram` instances in the same process. The reporter's own 6-separate-compile measurement (145→22 ms from the 2nd compile) is direct proof. So `-pch` needs **no program-reuse refactor** — just add the flag on the version gate and manage the global heap. This is the single biggest scoping correction; getting it wrong turns a ~1-day change into a driver-lifetime rework.

Two more NVRTC-driver gotchas confirmed the same session:
1. **Don't add the new PCH entry points to the `SLANG_NVRTC_FUNCS` macro list.** The loader `SLANG_NVTRC_GET_FUNC` (~:184-187) does `return SLANG_FAIL` if ANY listed symbol is null; the PCH symbols don't exist pre-12.8, so adding them there breaks NVRTC `init()` on every toolkit < 12.8. Load them via a **separate null-tolerant `findFuncByName`** path, gated on `m_desc.version >= 12.8` (the gate branch already exists at ~:1288).
2. **The CUDA prelude reaches NVRTC as raw prepended text** (`slang-emit.cpp` ~:2956-2958 emits `getPreludeForLanguage`), not as an `#include`d header (the driver's `headers`/`headerIncludeNames` lists are left empty, ~:1335-1336). Automatic `-pch` mode precompiles a leading prefix of the TU text, so it works on the prepended-prelude `.cu` with no header-injection refactor.

Meta-lesson: DeepWiki and a code-reading subagent both correctly described the *mechanics* (fresh program per compile) but drew a wrong *inference* about an external API's semantics. Verify external-toolkit behavior (here, NVRTC PCH lifetime) against the vendor docs before passing a "primary blocker" downstream. (shader-slang/slang#12622)
