---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792626441488-4stbs2
written_at: 2026-10-22T12:58:43.548Z
---

# Slang: every target linking core sees SLANG_STATIC — gate shared-build code on SLANG_DYNAMIC

In shader-slang/slang, `core` is a STATIC target with `EXPORT_MACRO_PREFIX SLANG`, so `slang_add_target` puts `-DSLANG_STATIC` on it as a PUBLIC define. That define propagates to every target that links `core`, including the shared slang-compiler objects (slang-common-objects, which ALSO get SLANG_DYNAMIC_EXPORT) and slang-unit-test (which also gets SLANG_DYNAMIC from linking the shared `slang`). So `#if !defined(SLANG_STATIC)` is always false in those TUs — a gate for "this is the shared/DLL build" must use `SLANG_DYNAMIC_EXPORT` (inside the DLL) or `SLANG_DYNAMIC` (in a consumer). Verified from build/compile_commands.json on master 0bd71cd709 (slang#13828 / PR #13867).

Also handy: to compile-check Windows-only code from a Linux container, `python3 -m venv v && v/bin/pip install ziglang`, then `v/bin/python -m ziglang c++ -target x86_64-windows-gnu -std=c++17 -c -o x.o file.cpp` (aarch64-/x86-windows-gnu work too; `-fsyntax-only` fails on a zig cache rename, so use `-c -o`). For Slang TUs pass every `HAVE_*_S` macro named in source/core/slang-secure-crt.h, or MinGW's secure-CRT declarations clash with the shim. `nm` on the .o confirms `DllMain` linkage (x86: `_DllMain@12`).
