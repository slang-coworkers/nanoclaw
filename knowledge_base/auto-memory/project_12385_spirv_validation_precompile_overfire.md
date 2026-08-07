---
name: project_12385_spirv_validation_precompile_overfire
description: "slang#12385 — SPIR-V validation over-fires on a precompile-for-target, rejecting the Linkage capability/Export decorations that make it linkable. Fixer-filed 2026-08-06 06:18Z, triager labelled+typed it. Third artifact of the #12371 family. Carries a separate ABI hole: AbortCompilationException escapes precompileForTarget (0 catch sites in slang-compiler-tu.cpp). PARKED with #12383 on operator Q1."
metadata: 
  node_type: memory
  type: project
  originSessionId: 0dacff7c-b2e0-4955-93f6-07f27abcd3f8
---

# slang#12385 — validation over-fires on a precompile-for-target

Filed 2026-08-06 06:18:19Z by `nv-slang-bot[bot]` (the fixer, while shaping #12382's unit test).
OPEN, **0 comments**, no assignee. Labels `Diagnostics` + `spirv_validation` + **`reproduced`**,
Issue Type **Bug** — all four applied by `slang-triager` after the fact, since the fixer filed it
bare. Cross-references #12383.

**Defect:** the validation gate does not know a precompile-for-target is by construction *not* a
final module, so an ambient `SLANG_RUN_SPIRV_VALIDATION=1` rejects the precompiled library for the
`Linkage` capability and `Export` decorations that are exactly what make it linkable. Framing to
prefer (triager's, and it is the principled one): **precompilation should imply the existing
suppression** — not a new special case.

**Why it exists:** it surfaced as a *test workaround*. #12382's
`unit-test-spirv-link-validation.cpp` must wrap its precompile in
`ScopedEnvVar("SLANG_RUN_SPIRV_VALIDATION", "0")` because CI exports the var globally. The second
commit on that branch (`b52dba91`) rewrote the comment there to name #12385 and say *"once that gate
is fixed this window can be removed"* — i.e. the workaround is now self-documenting rather than
mysterious. ⭐ The generalizable bit: **a test that must disable a check to pass is evidence about the
check, not just about the test.**

## The ABI hole is a SEPARATE defect that #12385's fix does not close

Verified on my own clone at `9eb90c50a` (see
[[feedback_a_catch_site_census_must_split_convert_from_rethrow]] for the census method):

- `Module::precompileForTarget` is at `slang-compiler-tu.cpp:91`, `ComponentType::` overload at
  `:278`. **`grep -c catch` on that file → 0.** An `AbortCompilationException` raised inside escapes
  the C ABI boundary. Confirmed.
- ⚠️ **`SLANG_NO_THROW` is Windows-conditional.** It is on the declaration
  (`include/slang.h:5694`), but expands to `__declspec(nothrow)` **only** under
  `SLANG_WINDOWS_FAMILY && !defined(SLANG_DISABLE_EXCEPTIONS)` (`include/slang.h:205-213`) — empty
  elsewhere. So *"declared contract violation and UB"* is an **MSVC-family** claim; the escape is
  real on all platforms, the UB-by-declaration framing is not.
- ⚠️ **The convention census is 13 sites, not 12, and only 8 of them convert.** Five
  (`slang-check.cpp:212`,`:230`; `slang-lower-to-ir.cpp:10006`,`:14816`;
  `slang-emit-c-like.cpp:3147`) are internal `catch (…) { throw; }` sites that exist only to skip a
  sibling `catch (...)`'s `noteInternalErrorLoc` — they *re-raise*, so they are evidence against
  being boundaries. The real convention is the 8 that call `outputExceptionDiagnostic` then
  `return nullptr` / `SLANG_FAIL` (`slang-session.cpp` ×4, `slang-reflection-api.cpp` ×2,
  `slang-linkable.cpp:484`, `slang-end-to-end-request.cpp:1927`).

⭐⭐ **Triager's residual, which is the load-bearing point and worth keeping:** fixing the gate removes
this *trigger*, not the *class*. Any other fatal-or-internal diagnostic raised inside
`precompileForTarget` escapes identically. **A maintainer closing #12385 must not assume the ABI hole
closed with it** — it wants its own guard (a `try`/`catch` converting to `SlangResult`, matching the 8
boundary sites).

Also standing: `precompileForTarget` is documented **experimental and not thread-safe**
(`include/slang.h:5688-5695`).

## Family state (verified 2026-08-06 ~06:30Z)

| artifact | state | notes |
|---|---|---|
| #12371 | open, 1 comment | original defect; verdict patched in place, never stacked |
| **#12382** | **draft**, head `b52dba91` | A1 fix, `Fixes #12371`, +190/−7 |
| #12383 | open, 0 comments | A2 — validation precedes `spirv-opt`/debug-strip |
| **#12385** | open, 0 comments | this issue |

⛔ **#12382's head moved `5c4c63d1 → b52dba91` via a REAL COMMIT, not a body edit** — 2 files, and
one is `slang-emit.cpp` promoting `SLANG_ASSERT` → `SLANG_RELEASE_ASSERT` on the word-size check
at `:3433`. ⭐ **That REMOVES A UB PATH, not merely adds a release abort**: `SLANG_ASSERT` expands to
`SLANG_ASSUME` in non-`_DEBUG` builds (`slang-common.h:363-372`), so a violated check was previously
UB the optimiser could exploit — and unlike `SLANG_NO_THROW`, that gate is cross-platform
(`_DEBUG` is set for every compiler by `cmake/CompilerFlags.cmake:206-207`). See
[[feedback_slang_assert_becomes_assume_in_release_not_a_skipped_check]]. Mechanism and why the mischaracterization mattered:
[[feedback_a_metadata_edit_cannot_move_additions_deletions]]. The forward link into #12382's body is
**still absent** (`mentions_12383: false`, dangling *"right next step"* sentence still at `:116` as of
06:21:53Z) — that edit is in flight with the fixer, not done.

Parent chain: [[project_12371_spirv_prelink_validation_buffer]]. Sibling:
[[project_12383_spirv_validation_before_spvopt_strip]]. Operator Q1 (A1-only vs A1+A2) is the only
open decision; the draft sits until a human flips it.
