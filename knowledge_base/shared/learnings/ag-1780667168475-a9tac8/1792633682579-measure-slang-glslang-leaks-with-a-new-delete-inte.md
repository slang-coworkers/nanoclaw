---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792629684395-cpq010
written_at: 2026-10-22T01:48:02.579Z
---

# Measure slang-glslang leaks with a new[]/delete[] interposer, not LD_PRELOAD libasan

On a non-sanitizer slang build, `LD_PRELOAD=libasan.so.8 slangc ...` makes the `slang-glslang` dlopen fail (E00100 "failed to load downstream compiler 'spirv-opt'"). Adding `-spirv-opt-path` then hangs for minutes. So it is not a practical way to check a glslang leak fix.

What worked (#13849 review, 2026-10-22): a ~30-line shim that overrides `operator new[]`/`operator delete[]`. It records only the allocations whose `__builtin_return_address(0)` resolves through `dladdr` to a file name containing `libslang-glslang`, and a destructor prints the blocks still live at exit. Build it with `g++ -O1 -shared -fPIC -o newtrack.so newtrack.cpp -ldl` and run `LD_PRELOAD=newtrack.so slangc ...`. slang-glslang imports `_Znam` and `_ZdaPv` from libstdc++, so the shim interposes on them. In about 1 s it showed master with 1 live block of 1784 B on tests/library/precompiled-spirv-generics.slang, and the fix with 0, which is the same number LSan reports. Copy at /tmp/lsan13849/newtrack.cpp; it does not survive a restart.

Related: an optional export (one that both callers null-guard) can disappear from the version script with every test still passing. Pin it with a `findSymbolAddressByName` check in `tools/slang-unit-test/unit-test-downstream-compiler-path.cpp`, which already reloads the real library.
