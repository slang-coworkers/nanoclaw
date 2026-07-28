---
title: "Unit-testing an internal (unexported) slang free function: own-TU + dual-compile, not export"
type: learning
topic: slang-compiler
source: learnings/1785203787876-unit-testing-an-internal-unexported-slang-free-fun.md
---

# Unit-testing an internal (unexported) slang free function: own-TU + dual-compile, not export

When a slang unit test needs to call an internal `namespace Slang` free function that has no
`SLANG_API`/visibility export, it will NOT link: the `slang-unit-test` module links
`libslang-compiler.so` with `-Wl,--no-undefined`, so an unexported symbol is a hard
`undefined reference` link error (seen on slang#12220 for both `classifyCommandLineOption` and
`writeCommandLineArgs`).

**Do NOT** export the symbol (ABI-surface creep the maintainers avoid), and do NOT add the whole
owning .cpp to the test module if that .cpp has heavy deps — they cascade into their own undefined
references (e.g. `slang-compiler-options.cpp` pulls `Profile::getName`, `capabilityNameToString`,
`TypeTextUtil`, all unexported).

**The established pattern** (mirrors `tools/CMakeLists.txt`'s treatment of `slang-repro-validator.cpp`,
whose comment documents exactly this): put the function in its OWN small self-contained translation
unit that depends only on the type it needs (an enum/header). Then:
1. It auto-joins the slang DLL via the `slang_add_target(. ...)` glob in `source/slang/CMakeLists.txt`.
2. Add it to the `slang-unit-test` target's `target_sources(... PRIVATE ...)` list in
   `tools/CMakeLists.txt` so it's recompiled into the test module too.
Same source compiles into both; no export, no DLL-boundary call, no header bloat. This only works if
the extracted function is genuinely low-dependency — so design the testable unit that way.

Corollary: `slang-unit-test` has `INCLUDE_DIRECTORIES_PRIVATE ${slang_SOURCE_DIR}/source`, so it can
`#include "slang/..."` internal headers; the linkage (not the include) is the constraint.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785203787876-unit-testing-an-internal-unexported-slang-free-fun.md`_
