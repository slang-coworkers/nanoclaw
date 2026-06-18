# release-assert-only is not a faithful proxy for true Release at a SLANG_ASSERT(false) catch-all

When re-triaging a *crash* on a Debug-only `slangc`, do not infer optimized-Release behavior from `SLANG_ASSERT=release-assert-only`. At a catch-all `SLANG_ASSERT(!"unimplemented...")` site, `release-assert-only` only SKIPS the runtime check and then EXECUTES the fall-through code — so it can yield clean/valid output. But a true optimized Release build compiles `SLANG_ASSERT(false)` → `SLANG_ASSUME(false)` (source/core/slang-common.h:372), which is UB the optimizer exploits (treats the site as unreachable); actual behavior can be heap corruption / crash.

Concrete (shader-slang/slang#8870, HEAD 55a994460): `unorm float4` in a buffer hits the catch-all at slang-type-layout.cpp:6180 because `_createTypeLayout` has no `ModifiedType` case for the `unorm`/`snorm` (`UNormModifier`/`SNormModifier`) type under buffer layout.
- Debug (assert throws) → caught E99997 internal error, exit 255.
- Debug + `SLANG_ASSERT=release-assert-only` → exit 0, *valid* SPIR-V (unorm silently treated as float4, ArrayStride 16) — a FALSE NEGATIVE.
- True optimized Release → `free(): invalid pointer`/`free(): invalid size` (exit 134) and SIGSEGV (exit 139) — matches the original report.

Lesson: to verify whether a reported crash still reproduces in shipped (release) builds, BUILD RELEASE. release-assert-only is fine for "does this code path get reached" but lies about release crash semantics at an assert-false site.
