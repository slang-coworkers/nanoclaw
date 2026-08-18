---
title: "Slang slangc -v version string is a cached CMake value, NOT proof of compiled commit (bisect trap)"
type: learning
topic: slang-compiler
source: learnings/1782898953945-slang-slangc-v-version-string-is-a-cached-cmake-va.md
---

# Slang slangc -v version string is a cached CMake value, NOT proof of compiled commit (bisect trap)

**Context:** triaging shader-slang/slang#11877 (user `operator*` on matrix types silently dropped). Nearly posted a WRONG verdict ("regression predates #11493") because of this trap.

**The trap.** `slangc -v` prints a version string (e.g. `2026.10.2-33-g5230a81f2`) that is baked in at **CMake configure time** (`git describe`), and cached. An incremental `cmake --build --preset debug` after a bare `git checkout <other-commit>` recompiles the *source* of the new commit but does **NOT** re-run configure, so the version string stays frozen at whatever commit was last configured. Result: a binary built from commit X can report the version of commit Y. A machine's prebuilt `build/Debug/bin/slangc` similarly tells you nothing reliable about which commit it was built from.

**How it bit me.** The prebuilt binary reported `...g5230a81f2` and reproduced the bug, so I assumed "5230a81f2 is bad" and used it as a `git bisect` bad endpoint. `git bisect start <bad> <good>` **assumes** the bad endpoint without testing it. The bisect then fingered #11112 — an IR-lowering-pass-only commit that mechanically **cannot** affect front-end overload resolution. That impossibility is what exposed the bad assumption.

**The rule.** For "which commit does this binary correspond to?" / bisect endpoints, NEVER trust `slangc -v`. Instead:
1. Fresh-build the exact checked-out commit, and
2. Cross-check with a source-level symbol: `nm -C build/Debug/lib/libslang-compiler.so | grep -c <symbol-added-by-the-suspect-commit>`. Presence/absence of the symbol proves the compiled source, independent of the version string.
Also: a `git bisect` bad endpoint is assumed, not tested — verify it with a fresh build before trusting the bisect's conclusion, especially if the result is mechanically implausible (e.g. an IR-pass commit blamed for a front-end regression).

**Resolved root cause (bonus):** #11877 IS caused by #11493 (`61ad43dbc`, "Hard-code a fast path for builtin scalar/vector/matrix operators"), confirmed by a clean GOOD→BAD flip on fresh symbol-checked builds (parent `956f6ed52` no `convertToBuiltinArithmeticOp` symbol → honors overload; #11493 symbol present → bare `*`). The fast path in `visitInvokeExpr` (slang-check-expr.cpp:5007→5008) returns a `BuiltinOperatorExpr` before overload resolution (:5044); the only matrix deferral is GLSL-scope-gated (:4723-4733). Fix direction (validated: the pre-fast-path path honors the overload): defer to overload resolution when a non-core user `operator OP` is in scope, mirroring the GLSL-scope bail — with a *cheap* in-scope-overload check so #11493's perf intent (skipping overload resolution) survives the common no-overload case.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782898953945-slang-slangc-v-version-string-is-a-cached-cmake-va.md`_
