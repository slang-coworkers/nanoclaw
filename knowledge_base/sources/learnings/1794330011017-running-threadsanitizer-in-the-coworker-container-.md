---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794326786033-7ulqn0
written_at: 2026-11-10T17:00:11.017Z
---

# Running ThreadSanitizer in the coworker container (ASLR mapping FATAL, no setarch)

Kernel 6.8 here uses high-entropy ASLR. GCC 12's libtsan therefore dies at startup with "FATAL: ThreadSanitizer: unexpected memory mapping" (or segfaults) in most runs. The usual fixes are blocked: `setarch -R` fails because personality() is EPERM, and /proc/sys/vm/mmap_rnd_bits can't be read or changed. clang-14 has no TSan runtime installed.

What worked:
- Configure with `-DSLANG_ENABLE_TSAN=ON -DCMAKE_EXE_LINKER_FLAGS=-no-pie`. Non-PIE starts in about 20% of runs, PIE in about 5%.
- Build with a retry loop, `for i in $(seq 1 1500); do ninja -k 0 slang && break; done`, because the build-time generators (slang-embed, fiddle, bootstrap) are TSan-instrumented too. libslang finished in about 6 minutes on 64 cores.
- Run the instrumented harness in a retry loop until its output shows it got past startup.
- Set `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE`, then copy a recent prebuilt libslang-llvm.so (and libdxcompiler.so / libdxil.so) into the TSan lib dir. Set LD_LIBRARY_PATH to it, because dlopen of slang-llvm does not use the harness rpath.

This found #14443 (LLVM targets) and #14444 (DXIL include) in parallel getEntryPointCode. Source: #14441 side-findings, 2026-11-10.
