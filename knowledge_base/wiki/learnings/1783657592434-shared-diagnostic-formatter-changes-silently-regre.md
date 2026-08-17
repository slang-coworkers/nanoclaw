---
title: "Shared diagnostic formatter changes silently regress unrelated exhaustive diag= goldens (masked on draft CI)"
type: learning
topic: ci-tooling
source: learnings/1783657592434-shared-diagnostic-formatter-changes-silently-regre.md
---

# Shared diagnostic formatter changes silently regress unrelated exhaustive diag= goldens (masked on draft CI)

## What
Changing a **shared type/name formatter** — `getTypeNameHint` in `source/slang/slang-ir-util.cpp`, or anything reached by `printDiagnosticArg` (`source/slang/slang-ir.cpp:36`, the generic `IRInst`/`IRType` diagnostic-argument renderer) — can silently alter the **message text of completely unrelated diagnostics**.

Concrete case (PR #12005 / issue #7878): I added a `case kIROp_OptionalType` to `getTypeNameHint` so a new diagnostic (E41037) could render `Optional<T>`. That same helper is invoked by `printDiagnosticArg` for a **pre-existing, unrelated** `__ref`/`__constref` dynamic-dispatch diagnostic, which had been rendering an `IROptionalType` param as the empty string `''`. My change made it render `'Optional<IFoo>'`. The exhaustive `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` golden `tests/language-feature/dynamic-dispatch/diagnose-ref-interface-in-compound.slang` (and its `.1` hlsl variant) then failed on BOTH the position-match ("column matched but message didn't contain expected substring") AND the exhaustive check ("N diagnostic(s) without annotations").

## Why it bites
1. **Draft-PR CI hides it.** On a draft, build/test jobs are SKIPPED (only `check-ci`+`wait-for-human-priority` show a cosmetic "failure"). The regression surfaces ONLY when the PR flips non-draft and the real `pull_request` build path runs — often after a maintainer has already approved.
2. **`.slang` goldens are runtime-interpreted**, so a stale golden isn't caught by a C++ rebuild; you must actually run the affected test.
3. Two-directory local sweeps DON'T bound it fully — diagnostic goldens also live under `tests/glsl-intrinsic/`, `tests/autodiff/`, `tests/compute/`, etc.

## What to do
- When you touch a shared render/format helper, **grep its callers** (`grep -rn getTypeNameHint source/slang/`) AND **run the broad diagnostic dirs locally** (`tests/diagnostics/`, `tests/language-feature/dynamic-dispatch/`) before trusting draft CI. Defer the rest to the full `pull_request` run and SAY SO in the report — don't claim a two-dir sweep "covers every diagnostic golden."
- The exhaustive-check failure output **prints the exact replacement annotation** ("Suggested annotations you can copy"). Copy it verbatim: caret columns are almost always unchanged (only the message text moved), so the fix is a pure message refresh, not a re-alignment.
- This is a genuine golden **refresh** (the message became more informative), not silencing — but confirm via merge-base that YOUR change is the reaching edit before touching a pre-existing test (blast-radius rule).

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783657592434-shared-diagnostic-formatter-changes-silently-regre.md`_
