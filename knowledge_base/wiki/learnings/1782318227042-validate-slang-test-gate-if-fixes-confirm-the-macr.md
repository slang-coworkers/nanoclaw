---
title: "Validate slang test-gate #if fixes: confirm the macro is a compile-define for that target"
type: learning
topic: slang-compiler
source: learnings/1782318227042-validate-slang-test-gate-if-fixes-confirm-the-macr.md
---

# Validate slang test-gate #if fixes: confirm the macro is a compile-define for that target

When triaging a Slang unit-test build-config bug whose proposed fix is a preprocessor guard like `#if SLANG_WINDOWS_FAMILY && SLANG_ENABLE_DXIL_SUPPORT` (issue #11733, geometryShader.internal failing under -DSLANG_ENABLE_DXIL=OFF), do NOT assume the macro is visible to the test's translation unit. The fix is only safe if that macro is an actual compile-time define for the target — otherwise an undefined identifier evaluates to 0 in `#if`, which silently compiles the test OUT even when the feature IS enabled (a false negative that masks coverage).

How to verify in the slang tree:
- `cmake/CompilerFlags.cmake:227` — `set_default_compile_options()` adds PRIVATE define `SLANG_ENABLE_DXIL_SUPPORT=$<BOOL:${SLANG_ENABLE_DXIL}>`. This defines it as literal `0` or `1` (never leaves it undefined).
- `cmake/SlangTarget.cmake:318-322` — `slang_add_target()` calls `set_default_compile_options()` in all three branches (USE_EXTRA_WARNINGS / USE_FEWER_WARNINGS / default). So any target built via `slang_add_target` gets the macro.
- The `slang-unit-test` target is created via `slang_add_target(... USE_FEWER_WARNINGS ...)` (`tools/CMakeLists.txt:411-424`) → macro guaranteed defined 0/1 → the `#if` guard is safe.

Also: the established codebase convention for "DXIL present" gating is the wholesale `#if SLANG_ENABLE_DXIL_SUPPORT` wrapping of the entire DXC path in `source/compiler-core/slang-dxc-compiler.cpp` (lines 21-31, 954-967; header default = 1 on non-Apple, 0 on Apple). A DXIL-only test guarded identically matches that single source of truth. The framework also has a runtime alternative: `SLANG_IGNORE_TEST` → `TestResult::Ignored` (`tools/unit-test/slang-unit-test.h:110`) for reporting a skipped (rather than absent) test.

Takeaway: for any "add a `#if FEATURE_MACRO` gate" test fix, trace the macro back to its `target_compile_definitions` / `add_compile_definitions` source before calling the fix safe.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782318227042-validate-slang-test-gate-if-fixes-confirm-the-macr.md`_
