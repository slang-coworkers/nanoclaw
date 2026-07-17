---
title: "slang-wasm bindings expose NO compiler-option surface (createSession takes only an int target)"
type: learning
topic: slang-compiler
source: learnings/1784153472052-slang-wasm-bindings-expose-no-compiler-option-surf.md
---

# slang-wasm bindings expose NO compiler-option surface (createSession takes only an int target)

**Verified at HEAD 8e3f9163d (2026-07-15).** The Slang WASM/JS bindings do **not** let a JS caller pass compiler options like `-allow-glsl`.

- The only session entry point exposed to JS is `GlobalSession.createSession(int compileTarget)` — `source/slang-wasm/slang-wasm-bindings.cpp:18-22` (embind block) and `source/slang-wasm/slang-wasm.h:327`.
- Its implementation `GlobalSession::createSession` (`source/slang-wasm/slang-wasm.cpp:74-99`) builds a zero-initialized `SessionDesc`/`TargetDesc` setting only `.format` (and a hardcoded `sm_6_6` profile for HLSL). It never populates `compilerOptionEntries`, `compilerOptionEntryCount`, or `allowGLSLSyntax`.
- No `SessionDesc`, `TargetDesc`, `CompilerOptionEntry`, `CompilerOptionName`, `CompilerOptionValue` types are bound to embind at all. The generated `interface.d.ts` (via `--emit-tsd`, `CMakeLists.txt:29`) therefore only surfaces methods, no option structs.
- WASM examples/tests confirm target-only usage: `tests/wasm/smoke/smoke-test.js`, `examples/wgpu-slang-wasm/example.js`.

**How `-allow-glsl` normally reaches the compiler (for reference / what a binding change would need):** the CLI flag `-allow-glsl` (`slang-options.cpp:1191`) maps to `CompilerOptionName::AllowGLSL = 91` (`include/slang.h:1089`), which the compiler reads in the parser, checker, and IR-link (e.g. `slang-parser.cpp:9959`, `slang-ir-link.cpp:2040`). Via the public C++/COM API you set it through `SessionDesc::compilerOptionEntries` (an array of `{name: AllowGLSL, value}`), which `Session::createSession` loads at `slang-global-session.cpp:855`. NOTE: the `SessionDesc::allowGLSLSyntax` bool field (`include/slang.h:4338`) is **NOT read** at session creation — repo-wide it is only touched by record-replay; the live path is `compilerOptionEntries`. So the authoritative programmatic way is a `CompilerOptionEntry{AllowGLSL}` in `compilerOptionEntries`, not the bool.

**Bottom line for JS users:** enabling `-allow-glsl` (or any compiler option) from JS is a genuine gap today — the WASM binding surface would have to expose `CompilerOptionEntry`/`compilerOptionEntries` (or a bool param) and thread it into `createSession`. The Slang Playground is a separate repo (shader-slang/slang-playground), not in-tree.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784153472052-slang-wasm-bindings-expose-no-compiler-option-surf.md`_
