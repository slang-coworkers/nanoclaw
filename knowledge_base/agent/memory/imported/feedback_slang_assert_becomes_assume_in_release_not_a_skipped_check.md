---
name: feedback_slang_assert_becomes_assume_in_release_not_a_skipped_check
description: "In Slang, SLANG_ASSERT expands to SLANG_ASSUME in non-_DEBUG builds ([[assume]]/__builtin_unreachable/__builtin_assume/__assume) — so a violated SLANG_ASSERT in release is UB the optimiser may exploit, NOT a skipped check. Promoting to SLANG_RELEASE_ASSERT removes a UB path. Cross-platform, unlike SLANG_NO_THROW."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0dacff7c-b2e0-4955-93f6-07f27abcd3f8
---

# `SLANG_ASSERT` in release is `SLANG_ASSUME`, not a no-op

**Verified 2026-08-06 at `9eb90c50a`, `source/core/slang-common.h:363-372`:**

```cpp
#ifdef _DEBUG
#define SLANG_ASSERT(VALUE)  /* ... handleAssert(..., false) ... */
#else
#define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)
#endif
```

`SLANG_ASSUME` (`:335-356`) is, by toolchain: `[[assume(X)]]` when `__cpp_assume` ·
`if (!(X)) __builtin_unreachable();` on GCC · `__builtin_assume` on Clang · `__assume` on MSVC · and
an explicit `invokeUndefinedBehaviour()` fallback. **Every arm hands the optimiser a licence to assume
the condition holds.**

⇒ **A violated `SLANG_ASSERT` in a release build is undefined behaviour the compiler may optimise
on** — dead-code-eliminating the false branch, propagating the assumed range — **not a check that
was skipped.** That inverts the usual mental model of "debug assert = free in release".

**Consequence for review:** promoting `SLANG_ASSERT` → `SLANG_RELEASE_ASSERT` is a **safety
improvement that removes a UB-on-violation path** and replaces it with a defined abort
(`handleAssert(..., true)`, `:374-379`, unconditional). Describing such a commit as "now aborts in
release builds" undersells it and invites a reviewer to weigh it as *added* strictness with a
crash risk, when the honest framing is *removed UB*. I made exactly that error: I reported the
change to the operator as "promotes a debug-only check into an abort that fires in release builds",
which is true and materially incomplete. A peer supplied the `#define`.

**⚠️ Contrast with `SLANG_NO_THROW`, and why the contrast is the lesson.** Both are `SLANG_*`
decorations whose real semantics live in a `#define`, but they scope differently:

| | gate | scope |
|---|---|---|
| `SLANG_NO_THROW` | `SLANG_WINDOWS_FAMILY && !defined(SLANG_DISABLE_EXCEPTIONS)` (`include/slang.h:205-213`) | **MSVC-family only**; empty elsewhere |
| `SLANG_ASSERT`→`ASSUME` | `#ifdef _DEBUG` | **all platforms** — `_DEBUG` looks like an MSVC-ism but `cmake/CompilerFlags.cmake:206-207` sets it via `$<$<CONFIG:Debug>:_DEBUG>` for every compiler |

⭐⭐ **So "this looks like a Windows-only macro" is not transferable between the two.** I had just
correctly narrowed a `nothrow` claim to MSVC-family, and the adjacent `_DEBUG` gate invites the same
narrowing — where it would be **wrong**, because CMake defines `_DEBUG` cross-platform. Having just
applied a scope caveat correctly is not evidence the next one needs it. **Read each `#define` and its
build-system definition; do not pattern-match from the neighbour you just checked.**

**How to apply:**

- Before characterizing any assert-macro change in this codebase, read `slang-common.h:335-380`. The
  three macros are genuinely different: `SLANG_ASSERT` (debug-abort / release-**assume**),
  `SLANG_RELEASE_ASSERT` (always abort), `SLANG_ASSUME` (assume only).
- ⇒ Generalise: **a macro's identifier is not its semantics, and a decoration's reach is set by its
  `#define` plus the build system.** `grep` the definition *and* who defines the gate.
- When reporting a diff that promotes an assert, say **"removes a UB-on-violation path"** — that is
  what a correctness reviewer weighs.

Instance: [[project_12385_spirv_validation_precompile_overfire]] (commit `b52dba91` on PR #12382,
`slang-emit.cpp:3433` word-size check). Related:
[[feedback_a_metadata_edit_cannot_move_additions_deletions]] (how that commit was mischaracterized in
the first place), [[feedback_a_catch_site_census_must_split_convert_from_rethrow]] (the `nothrow`
scope narrowing).
