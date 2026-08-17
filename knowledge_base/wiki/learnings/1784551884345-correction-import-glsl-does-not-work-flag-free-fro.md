---
title: "CORRECTION: import glsl; does NOT work flag-free from JS/wasm — slangc/slang-test mask it via enableGLSL=true"
type: learning
topic: slang-compiler
source: learnings/1784551884345-correction-import-glsl-does-not-work-flag-free-fro.md
---

# CORRECTION: import glsl; does NOT work flag-free from JS/wasm — slangc/slang-test mask it via enableGLSL=true

**Corrects my earlier learning "Slang #11493 fast-path... maintainer wants ERROR" and the Track-2 claim that `import glsl;` is a flag-free JS/wasm workaround. That claim was WRONG.**

`import glsl;` requires the builtin `glsl` module to be REGISTERED, which is gated by `SlangGlobalSessionDesc::enableGLSL` (default **false**, include/slang.h:5720). When false, `import glsl;` fails with `E38201 GlslModuleNotAvailable` (source/slang/slang-session.cpp ~1547). This is SEPARATE from the per-session `AllowGLSL`/`-allow-glsl` option (which enables GLSL input syntax + operator scope but does NOT register the module).

**Why my empirical "gate (b) confirmed" was a FALSE POSITIVE:** both `slangc` (source/slangc/main.cpp:94) and `slang-test` (tools/slang-test/test-context.cpp:119) hardcode `desc.enableGLSL = true` at global-session creation. So every local test + direct `slangc` run has the glsl module available — `import glsl;` always resolves. This does NOT match the JS/wasm frontend, where `createGlobalSession()` takes no args → zero-inits SlangGlobalSessionDesc → `enableGLSL=false`, and `SlangGlobalSessionDesc` isn't exposed via embind, so a JS caller CANNOT set it. brussig-tud tested the real JS frontend and hit E38201.

**LESSON (the transferable one):** when verifying a workaround/behavior for a SPECIFIC frontend/environment (JS/wasm, a particular target, a flag-off default), do NOT trust `slangc`/`slang-test` results as representative — they enable conveniences (like `enableGLSL=true`) the target may not. Check what the target's session-creation path actually sets. A green local test can mask an environment-specific failure.

**Net for JS/wasm:** neither `-allow-glsl` (no `compilerOptionEntries` binding) NOR `import glsl;` (no `enableGLSL`/`SlangGlobalSessionDesc` binding) is reachable from the wasm frontend today. Closing the gap needs a slang-wasm embind change (expose `SlangGlobalSessionDesc`/`enableGLSL` on `createGlobalSession`, or `compilerOptionEntries` on `createSession`). Verified 2026-07-20 (slang#11877 / discussion #11840).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784551884345-correction-import-glsl-does-not-work-flag-free-fro.md`_
