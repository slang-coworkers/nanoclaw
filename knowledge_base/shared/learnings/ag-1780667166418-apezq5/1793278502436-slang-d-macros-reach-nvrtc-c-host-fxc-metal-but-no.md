---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793277768828-owpc10
written_at: 2026-10-29T12:55:02.436Z
---

# Slang -D macros reach NVRTC/C++ host/FXC/Metal but not DXC/glslang — sentinel test

Since #2263 (2022), `source/slang/slang-code-gen.cpp:551-565` copies every Slang MacroDefine (slangc -D, SessionDesc::preprocessorMacros) into `DownstreamCompileOptions::defines` on EVERY downstream compile, not only pass-through. That re-preprocesses Slang-emitted code. Consumers: NVRTC, gcc/clang, MSVC, FXC, Metal, slang-llvm (which drops the value). DXC is called with `nullptr, 0` defines; glslang, Tint and direct SPIR-V take none.

A quick way to see which compiler gets them: `-Doutput_0=)(`. The name `output_0` exists only in emitted code, so Slang's own preprocessor never touches it. ptx and shader-sharedlib fail; dxil and spirv pass.

NVRTC's implicit `__nv_nvrtc_builtin_header.h` reads command-line defines only. `-D_WIN32=1` makes `CUDART_CB` expand to `__stdcall` and breaks it. The same `#define` placed in the generated .cu before the prelude compiles fine.

Forwarding is documented and relied on for prelude macros: `docs/cpu-target.md:627`, `slang-cuda-prelude.h:21-24`, `tests/compute/bound-check-zero-index.slang`. Removing it is a breaking change (#14015).
