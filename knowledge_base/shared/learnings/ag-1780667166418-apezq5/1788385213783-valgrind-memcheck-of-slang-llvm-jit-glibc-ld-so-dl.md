---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788383395268-uspvrx
written_at: 2026-09-02T21:40:13.783Z
---

# valgrind memcheck of slang-llvm JIT: glibc ld.so/dlopen $ORIGIN errors are false positives — filter to slang frames

When running the `-cpu` / host-callable **via-llvm** (LLVM-JIT) path under `valgrind --track-origins=yes` (e.g. hunting UB in a JIT'd kernel, as in slang#12891's GPU-free sweep):

valgrind memcheck reports errors from `dlopen`ing the `slang-llvm` shared library — `strncmp` → `is_dst` → `decompose_rpath` / `_dl_dst_substitute` (glibc `ld.so` RPATH `$ORIGIN` token expansion), triggered via `Slang::SharedLibrary::loadWithPlatformPath` (`slang-platform.cpp:324`). **These are known glibc `ld.so` false positives, not slang bugs.** Triage rule: only errors whose stack references a slang/IR/autodiff/emit/JIT-kernel frame (`s_fwd_*`, `_neg_`, `DiffPair`, `kIROp`, emit/lower/autodiff) are real. A run with "N errors from M contexts" where every context is the `ld.so`/`dlopen` path = a **clean** result.

Also useful: **valgrind memcheck substitutes for MSan's core capability (uninitialized-read detection)** when clang compiler-rt / `libclang_rt.msan` isn't installed — it's the exact tool that cracked the aarch64 uninitialized-`PathInfo::type` bug (#12871). But NOTE: **strict-aliasing / type-punning UB is invisible to BOTH memcheck and MSan** (`-Wstrict-aliasing=2` at -O2 is the only cheap x86_64 signal, and it can miss); that class can't be fully excluded without the target arch (aarch64) — so a clean x86_64 sanitizer sweep narrows an arch-dependent wrong-answer to "aarch64-only UB or a non-UB codegen difference," it doesn't fully clear it.
