---
title: "GLSL in Slang has TWO separate switches: global-session enableGLSL (module) vs per-session AllowGLSL (syntax)"
type: learning
topic: slang-compiler
source: learnings/1784551355408-glsl-in-slang-has-two-separate-switches-global-ses.md
---

# GLSL in Slang has TWO separate switches: global-session enableGLSL (module) vs per-session AllowGLSL (syntax)

**Verified at HEAD 6a244fee2 (2026-07-20).** Enabling "GLSL" in Slang is gated by **two distinct switches** that are easy to conflate (an earlier bot comment on #11877 conflated them and was wrong — `import glsl;` does NOT work with only the per-session option):

1. **`SlangGlobalSessionDesc::enableGLSL`** (global-session creation) — `include/slang.h:5720`, `bool enableGLSL = false`. Controls whether the builtin **`glsl` module is registered** at all. Read at `source/slang/slang-api.cpp` (the `if (desc->enableGLSL)` block that loads `BuiltinModuleName::GLSL`). If false, `import glsl;` fails with **`error[E38201]: 'glsl' module not available`** — emitted at `source/slang/slang-session.cpp:1547-1562` when `getBuiltinModule(GLSL)` returns null. Diagnostic defined `slang-diagnostics.lua` (id 38201).

2. **`CompilerOptionName::AllowGLSL`** (per-session option, = the `-allow-glsl` CLI flag) — `include/slang.h:1089`. Controls GLSL **input syntax** + the "GLSL operator scope" (matrix operators + vector ==/!= routed through overload resolution). Read at `slang-parser.cpp:9959`, `slang-check-modifier.cpp:1957`.

**Key gotcha:** `AllowGLSL` per-session is NOT sufficient to make `import glsl;` work — the module must have been registered via the global-session `enableGLSL`. They're orthogonal.

**WASM/JS reachability = NEITHER is settable today (2026-07-20).** `createGlobalSession()` in `source/slang-wasm/slang-wasm.cpp` is argument-less and calls the default `slang::createGlobalSession(&gs)` overload (`slang.h:6030`) that zero-inits the desc → `enableGLSL=false`; `SlangGlobalSessionDesc` is not embind-bound. And `GlobalSession.createSession(int target)` doesn't expose `compilerOptionEntries` (so `AllowGLSL` can't be set either). So a JS caller cannot enable GLSL by either route — confirmed capability gap, flagged to jkwak-work as a design point (#11877). See sibling learning "slang-wasm bindings expose NO compiler-option surface".

**Process lesson:** the earlier "`import glsl;` works flag-free from JS" claim was posted WITHOUT testing the global-session gate — a load-bearing claim about a code path should be verified (or the user's repro trusted) before asserting it publicly. brussig-tud's `E38201` repro was the ground truth.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784551355408-glsl-in-slang-has-two-separate-switches-global-ses.md`_
