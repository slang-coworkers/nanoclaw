---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788238199758-la5je6
written_at: 2026-09-01T05:53:31.293Z
---

# Slang unit tests for non-exported source/slang symbols must live in tools/slang-static-unit-test

When a regression test needs to call a non-exported `source/slang` C++ symbol directly (e.g. `CompilerOptionSet::getDownstreamArgs`, or anything defined out-of-line in a `source/slang/*.cpp`), it CANNOT go in the normal `tools/slang-unit-test/` suite.

**Why:** `slang-unit-test` is built as a shared MODULE that links `libslang-compiler.so`, which is compiled with `-fvisibility=hidden` (CXX_VISIBILITY_PRESET hidden, cmake/CompilerFlags.cmake). Out-of-line `source/slang` methods are LOCAL symbols (`nm -C` shows `t`, not `T`; absent from `readelf --dyn-syms`), so a test calling one fails at LINK time: `undefined reference to Slang::CompilerOptionSet::getDownstreamArgs(...)`. Header-INLINE methods (e.g. `add`, `getArray`) link fine because they compile into the test object itself — which is why existing option tests only touch inline methods and never hit this.

**Correct home:** `tools/slang-static-unit-test/` — a dedicated suite whose target (`slang-static-unit-test`, EXECUTABLE) links the compiler STATICALLY, resolving hidden symbols at link time. `slang_add_target` auto-globs that directory, so just dropping a new `*.cpp` there registers it (no CMake edit). It's a REQUIRED CI check on 3 platforms (ci.yml → ci-slang-static-unit-test.yml: linux-gcc-aarch64, macos-clang-aarch64, windows-cl-x86_64; all in the check-ci aggregate).

**How to build/run locally (matches CI):**
```
cmake --preset default --fresh -DSLANG_LIB_TYPE=STATIC -DSLANG_SLANG_LLVM_FLAVOR=DISABLE \
  -DSLANG_ENABLE_DXIL=OFF -DSLANG_DXC_BUILD_FROM_SOURCE=OFF -DSLANG_IGNORE_ABORT_MSG=ON \
  -DCMAKE_COMPILE_WARNING_AS_ERROR=ON
cmake --build build --config Debug --target slang-static-unit-test
./build/Debug/bin/slang-static-unit-test            # runs all; 6 harness self-checks report as "ignored" in an ordinary run
```
Note: this is a STATIC config that shares no objects with the default SHARED build, so it's a full rebuild (but LLVM/DXC disabled per the CI recipe keeps it lighter). `SLANG_CHECK` does NOT abort — guard element accesses after a count check with `SLANG_CHECK_ABORT(...)`. Do NOT inline the function into a widely-included header just to test it (I tried; it works but is non-minimal and adds header coupling) — the static-unit-test home is the sanctioned pattern. Also: the base worktree's git submodules may be uninitialized — run `git submodule update --init --recursive` if configure fails with a missing SPIRV-Headers target. (Found fixing slang#12861.)
