---
name: reference_slang_two_glsl_switches_unreachable_from_wasm
description: "Slang has TWO separate GLSL switches: SlangGlobalSessionDesc::enableGLSL (loads the glsl MODULE at global-session creation; off ⇒ `import glsl;` → E38201) and CompilerOptionName::AllowGLSL / -allow-glsl (GLSL syntax + operator scope, does NOT load the module). Neither is reachable from JS/WASM — re-verified on master 2026-10-03. slangc and slang-test hardcode enableGLSL=true, so local tests can't see the JS default."
metadata:
  node_type: memory
  type: reference
---

# Slang's two GLSL switches, and why JS/WASM reaches neither

Split out of [[project_11877_operator_overload_fastpath]], where it decided a user-facing answer
(brussig-tud on slang#11877 / Discussion #11840). Source-verified at `6a244fee2` (2026-07-20);
WASM bindings re-checked on master 2026-10-03, unchanged.

| switch | where | what it does |
|---|---|---|
| `SlangGlobalSessionDesc::enableGLSL` | `slang.h` (~5720), read in `slang-api.cpp` | loads `BuiltinModuleName::GLSL` at **global-session** creation. Off (default) ⇒ `import glsl;` → `E38201 'glsl' module not available` (`slang-session.cpp` ~1547-1562) |
| `CompilerOptionName::AllowGLSL` (`-allow-glsl`) | `slang.h` (~1089), via `SessionDesc::compilerOptionEntries` (loaded at `slang-global-session.cpp` ~855) | GLSL input **syntax** + operator scope. Does **not** register the glsl module |

So `-allow-glsl` alone cannot make `import glsl;` work.

⚠️ The public `allowGLSLSyntax` bool in `slang.h` is a red herring — only record-replay touches
it; session creation never reads it.

## JS/WASM reaches neither (re-verified 2026-10-03)

- `createGlobalSession()` (`source/slang-wasm/slang-wasm.cpp:58`) takes no arguments, so the desc
  is zero-initialised and `enableGLSL=false`. `SlangGlobalSessionDesc` is not bound.
- `GlobalSession::createSession(int compileTarget)` (`:74`) is the only session binding. It sets
  targets only, never `compilerOptionEntries`.
- `slang-wasm-bindings.cpp` binds no `SessionDesc`, `CompilerOptionEntry` or `CompilerOptionName`.

The minimal fix is to expose `enableGLSL` on WASM `createGlobalSession` and/or thread
`compilerOptionEntries` (or an `allowGLSL` flag) into `createSession`. The API shape is a
maintainer call. Playground is a separate repo (`shader-slang/slang-playground`), not checked.

## The test-harness trap

⛔ **`slangc` (`main.cpp` ~94) and `slang-test` (`test-context.cpp` ~119) both hardcode
`enableGLSL=true`.** Any local check of "does `import glsl;` work?" passes, while the JS default
fails. The fixer false-passed exactly this claim, and it reached a public comment and the #12162
PR body before being corrected. Verify a capability in the environment where it will actually
run, not in a harness that pre-sets the switch.
