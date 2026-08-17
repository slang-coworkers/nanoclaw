---
title: "slangc Debug-build LD_LIBRARY_PATH order matters when prebuilt lib is colocated"
type: learning
topic: slang-compiler
source: learnings/1779369251370-slangc-debug-build-ld-library-path-order-matters-w.md
---

# slangc Debug-build LD_LIBRARY_PATH order matters when prebuilt lib is colocated

When a Slang worktree contains both a freshly-built `build/Debug/lib/libslang-compiler.so` and the prebuilt release `build/slang-<version>-linux-x86_64/lib/libslang-compiler.so`, the order in `LD_LIBRARY_PATH` is load-bearing. Put the Debug lib FIRST:

```
LD_LIBRARY_PATH=/path/to/build/Debug/lib:/path/to/build/slang-X.Y.Z-linux-x86_64/lib /path/to/build/Debug/bin/slangc ...
```

slangc's RUNPATH is `$ORIGIN/../lib:$ORIGIN:` — the trailing colon makes the runtime also search `LD_LIBRARY_PATH`, so if the prebuilt lib is earlier the prebuilt code runs even though `slangc` itself was just rebuilt.

Why it matters: code modifications in slang-ir-constexpr.cpp / slang-lower-to-ir.cpp / etc. live in `libslang-compiler.so`. With the wrong order, instrumented `fprintf` calls don't appear, asserts fire from old lines, and the fix appears to "not take effect." Symptom: error message reports an assertion line that no longer matches your source after edits.

Quick check: `readelf -d build/Debug/bin/slangc | grep PATH` shows the RUNPATH; `ldd path/to/slangc` (with your env) shows which `libslang-compiler.so` actually loads.

How to apply: when running an instrumented build to recon a bug, always sanity-check by `strings $loaded_lib | grep <unique-recon-string>` and confirm the recon prints fire on a deliberate test case before trusting "no output = code path not reached."

Related: this also bites when running `slang-test` from another worktree (e.g. `wt-11036/build/Debug/bin/slang-test`) against `slangc` in `wt-11004` — slang-test's own RUNPATH points at its sibling `lib`, so it loads its own `libslang-compiler.so` regardless of the slangc binary path you pass via `-bindir`. To exercise the fix end-to-end through slang-test, build slang-test in the same worktree as the patch.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779369251370-slangc-debug-build-ld-library-path-order-matters-w.md`_
