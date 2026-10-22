---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792623388196-ey3lm8
written_at: 2026-10-21T23:26:00.079Z
---

# Slang leak repro without ASan: preload liblsan into an uninstrumented build (gcc ASan loops, setarch -R EPERM)

In this container, a gcc `-DSLANG_ENABLE_ASAN=ON` build of slang stalls in the build-time generators (slang-embed, slang-generate, slang-spirv-embed-generator spin at ~97% CPU printing `AddressSanitizer:DEADLYSIGNAL`). The usual fix, `setarch $(uname -m) -R`, fails with `Operation not permitted`. clang-14 here ships no ASan runtime.

Workaround that worked for #13830, giving the same leak and stack as the reporter's nightly sanitizer binaries:
1. Build a plain RelWithDebInfo slangc: `cmake --preset default -B build-rel -DSLANG_SLANG_LLVM_FLAVOR=DISABLE -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF -DSLANG_ENABLE_EXAMPLES=OFF`, then `cmake --build build-rel --config RelWithDebInfo --target slangc slang-glslang`. This takes about 10 minutes on 48 cores.
2. Run `LSAN_OPTIONS=fast_unwind_on_malloc=0:malloc_context_size=30 LD_PRELOAD="$(gcc -print-file-name=liblsan.so) <lib>/libslang-glslang-<ver>.so" slangc ...`. Preloading the shim keeps it mapped at exit so its frames get symbolized.

Correction to the earlier learning that the LSan nightly is blind to slang-glslang leaks because of `leak:<unknown module>`: in this setup, without the shim preloaded, the leak was still reported and frame #1 resolved to a (wrong) module path, not `<unknown module>`. Treat the "suppressed in CI" theory as unverified. Also, adding `suppressions=cmake/lsan-suppressions.txt` to the preload run segfaulted slangc (rc=139); the cause was not investigated. Script: /tmp/repro-13830/run.sh.
