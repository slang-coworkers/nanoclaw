---
title: "slang#12006 E41017 false-positive on export __global __extern_cpp host-provided globals"
type: learning
topic: slang-compiler
source: learnings/1783545729206-slang-12006-e41017-false-positive-on-export-global.md
---

# slang#12006 E41017 false-positive on export __global __extern_cpp host-provided globals

`checkUninitializedGlobals` in `source/slang/slang-ir-use-uninitialized-values.cpp:1210` warns E41017 ("use of uninitialized global variable") on `export __global __extern_cpp` globals, whose value is supplied by the host at runtime and thus have no in-module initializer by design. `docs/cpu-target.md:275-278` documents `__global public __extern_cpp int myGlobal;` as the sanctioned "set a global directly via host code" pattern, so this is a genuine false positive (verified @ d8e8e1a9e, `-target cpp`, no GPU; `= {}` just trades it for E30521 interface-default-init deprecation).

Key facts for a fixer:
- The exemption set at L1218-1224 covers only `IRSemanticDecoration`, `IRGlobalInputDecoration`, `IRVulkanHitAttributesDecoration` (all "externally-supplied" globals). `export __global __extern_cpp` is missing but belongs there.
- Such a global lowers to `IRExternCppDecoration` + `IRHLSLExportDecoration` + `IRExportDecoration` + `IRKeepAliveDecoration`. `__global` is a **rate qualifier only** (`maybeSetRate`), NOT a linkage decoration. `__extern_cpp` is an EXPORT in Slang's model (`isImportedDecl` ignores `ExternCppModifier`), though `isFunctionDefinedOrImported` in slang-ir-link.cpp treats `IRExternCppDecoration` as "defined elsewhere" — that helper is function-only, no global analog exists.
- **False-negative-safe by construction:** the check only reaches the diagnostic when the global has NO init block (early return L1227-1232) AND NO `Store` use anywhere (early return L1242-1243). So exempting external globals cannot mask a forgotten init that actually has a store.
- **Predicate-width is the maintainer call:** (A) exempt bare `IRExternCppDecoration` (issue's 1-line hypothesis, matches existing idiom) vs (B) `IRExternCppDecoration` AND export-linkage (`IRExportDecoration`/`IRHLSLExportDecoration`) — tighter, matches the documented host-provided pattern, still warns on a bare `__extern_cpp` internal global. (C) exempt on `export` alone is too broad. Regression test: `tests/diagnostics/`, `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):-target cpp`, assert no E41017.
- Motivated by #11989 (cpu-com-example blocks `-warnings-as-errors`). Filed by nv-slang-bot at @jkwak-work's request, self-assigned → PARKED, no auto-fixer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783545729206-slang-12006-e41017-false-positive-on-export-global.md`_
