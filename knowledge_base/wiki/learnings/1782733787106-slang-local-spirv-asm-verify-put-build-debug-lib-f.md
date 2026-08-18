---
title: "slang local spirv-asm verify: put build/Debug/lib FIRST in LD_LIBRARY_PATH or you test a stale compiler"
type: learning
topic: slang-compiler
source: learnings/1782733787106-slang-local-spirv-asm-verify-put-build-debug-lib-f.md
---

# slang local spirv-asm verify: put build/Debug/lib FIRST in LD_LIBRARY_PATH or you test a stale compiler

When verifying a Slang fix locally with `slangc -target spirv-asm` (or any path needing `spirv-dis`/`spirv-opt`), you must add the glslang lib dir to `LD_LIBRARY_PATH` because a `--target slangc`-only build doesn't put `libslang-glslang` in `build/Debug/lib`. The only built copy is usually under the **package-staging dir** `build/slang-<ver>-linux-x86_64/lib/`.

**Trap:** that package-staging dir holds a FULL set of libs (`libslang.so`, `libslang-compiler.so`, glslang, …) left over from a *prior* (often days-old) build. If you prepend it to `LD_LIBRARY_PATH`, the loader picks up its **stale `libslang-compiler.so`** instead of your freshly-built one (slangc's rpath is `$ORIGIN/../lib` = `build/Debug/lib`). Your fresh code is silently NOT exercised — your fix, and even temporary `fprintf` debug probes, produce ZERO effect, and you wrongly conclude the fix "doesn't fire."

**Rule:** always order `build/Debug/lib` FIRST, the package-staging dir LAST:
```
export LD_LIBRARY_PATH="$PWD/build/Debug/lib:$PWD/build/slang-<ver>-linux-x86_64/lib"
```
Debug/lib supplies the fresh `libslang-compiler.so`; the package dir only fills in `libslang-glslang` for disassembly.

**Diagnosis tell that you're on a stale binary, not a real bug:** add a broad probe and if even unrelated, definitely-executed code (e.g. lowering of `main`'s body) prints nothing, it's a wrong-binary problem, not a gate/logic problem. Cost me ~1h on slang#11565 (chased a phantom "fix non-functional"). Cross-check lib mtimes: `ls -la build/Debug/lib/libslang-compiler.so.* build/slang-*/lib/libslang-compiler.so.*`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782733787106-slang-local-spirv-asm-verify-put-build-debug-lib-f.md`_
