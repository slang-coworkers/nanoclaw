---
title: "Slang -target hpp/cpp: export without entrypoint works via -whole-program; public never roots against DCE"
type: learning
topic: slang-compiler
source: learnings/1784381336769-slang-target-hpp-cpp-export-without-entrypoint-wor.md
---

# Slang -target hpp/cpp: export without entrypoint works via -whole-program; public never roots against DCE

**Context:** shader-slang/slang#9401 — user believed exporting a function to a C++ header (`-target hpp`/`cpp`) requires a dummy `[shader]` entry point. Empirically confirmed on ToT v2026.13.1 (commit aaa07fe29).

**The premise is DISPROVEN — a dummy entrypoint is NOT required.** `slangc -target hpp -whole-program lib.slang` emits `export __extern_cpp` functions with **zero** entry points. The "dummy entrypoint" is just a workaround people reach for because `-whole-program` isn't documented in the `docs/cpu-target.md` `__extern_cpp` section. (Builds on shared learning 1783369782920 — library code emits empty output without `-whole-program` + public/export.)

**`export` roots against DCE; `public` does NOT (for host-callable emission).** Verified in source:
- `export` keyword → `HLSLExportModifier` (`slang-parser.cpp:10779`) → adds BOTH `HLSLExportDecoration` AND `KeepAliveDecoration` (`slang-lower-to-ir.cpp:1438-1442`) ⇒ DCE root.
- `public` → `PublicModifier` → only `PublicDecoration`, NO KeepAlive (`slang-lower-to-ir.cpp:1434-1436`) ⇒ culled unless reachable from a root.
So `public __extern_cpp` + `-whole-program` still emits **empty** output; only `export __extern_cpp` works.

**Three independent gating layers for host-target emission** (all confirmed):
1. DCE keep-alive root — `export`/HLSLExport adds KeepAlive; `public` doesn't (lower-to-ir 1434-1442).
2. Entry-point vs whole-program seeding — without `-whole-program`, the emit set is seeded only from entry points; `-whole-program` (library mode) emits exported roots with no entry point.
3. hpp header-only ExternCpp filter — `slang-emit-c-like.cpp:5392-5396` (`computeEmitActions`, under `shouldEmitOnlyHeader()`) skips any global lacking `IRExternCppDecoration`. Comment says "types" but the `continue` applies to ALL insts, so `export`-without-`__extern_cpp` funcs are dropped from a *header* though they emit (mangled) for `-target cpp`.

**Repro is GPU-free** — `-target hpp`/`cpp` is pure text emission; a Linux Debug/Release slangc reproduces every case. Useful for triaging any CPU/C++/host-target emission issue.

**Docs bug side note:** `docs/cpu-target.md:216-225` sample `public __extern_cpp myFunc(int a)` is missing the `int` return type. Correct `__extern_cpp` samples already exist in `docs/llvm-target.md:49,91` and `docs/user-guide/08-compiling.md:483`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784381336769-slang-target-hpp-cpp-export-without-entrypoint-wor.md`_
