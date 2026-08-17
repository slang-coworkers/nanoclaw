---
title: "Slang ASan/LSan build: detect_leaks=0 during build, full build won't fit ~9.4G disk, verify-without-link trick"
type: learning
topic: slang-compiler
source: learnings/1783079812616-slang-asan-lsan-build-detect-leaks-0-during-build-.md
---

# Slang ASan/LSan build: detect_leaks=0 during build, full build won't fit ~9.4G disk, verify-without-link trick

When verifying a Slang memory-leak fix under AddressSanitizer/LeakSanitizer (`-DSLANG_ENABLE_ASAN=ON`), three non-obvious things bite (learned on slang#11936, 2026-07-03):

1. **You MUST `export ASAN_OPTIONS=detect_leaks=0` DURING the build.** The whole project (including build-time codegen tools like `slang-fiddle`, `slang-capability-generator`) is ASan-instrumented, and those tools have pre-existing leaks. With the LSan default (`detect_leaks=1`), a tool run during the build exits non-zero → `ninja: build stopped: subcommand failed` (fails around the fiddle codegen step, ~[583/1427]). CI does exactly this: `.github/workflows/ci-slang-sanitizer.yml:133` sets `ASAN_OPTIONS=detect_leaks=0` for the build, then `detect_leaks=1:halt_on_error=0` + `LSAN_OPTIONS=suppressions=cmake/lsan-suppressions.txt` only for the TEST runs.

2. **A full ASan `slang-test` build does NOT fit in ~9.4G free** on the shared box. The irreducible core is ~8G of objects (source ~2.7G + spirv-tools/external ~2.3G + generators ~1.2G + tools ~1.0G) PLUS the libslang link — exceeds max free space on a 100%-full 251G volume. Disabling the optional big deps (`-DSLANG_ENABLE_DXIL=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`) does NOT rescue it (those barely start; the core is the wall). So a local ASan leak run is often infeasible → defer the runtime leak confirmation to CI's `ci-slang-sanitizer.yml`, which has the resources. Free your own dead partial `build/` with `rm -rf build` (courtesy on a full box) — never touch sibling worktrees.

3. **Verify a compiler-source change compiles WITHOUT linking** (when the full build won't fit): once the generators have run once (so `build/source/slang/fiddle/*.fiddle` exist), compile just the affected object(s):
   `ninja -f build/build-RelWithDebInfo.ninja <objpath>.o`
   e.g. `source/slang/CMakeFiles/slang-common-objects.dir/RelWithDebInfo/__/slang-record-replay/replay-context-record.cpp.o`. `touch` the source to force a recompile. This confirms your change compiles under the project's real flags + full include graph — far stronger than a synthetic standalone probe, and costs only a few MB. Much better than shipping a compiler change with zero local build feedback.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783079812616-slang-asan-lsan-build-detect-leaks-0-during-build-.md`_
