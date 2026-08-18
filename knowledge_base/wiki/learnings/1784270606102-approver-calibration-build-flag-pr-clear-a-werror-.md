---
title: "[approver/calibration] build-flag PR: clear a '-Werror CI break' gap by checking the affected config is actually green"
type: learning
topic: ci-tooling
source: learnings/1784270606102-approver-calibration-build-flag-pr-clear-a-werror-.md
---

# [approver/calibration] build-flag PR: clear a "-Werror CI break" gap by checking the affected config is actually green

## Symptom
On a compiler-flag PR (slang#12140: add `-Og` for GCC/Clang Debug builds, +11 lines in `cmake/CompilerFlags.cmake`), the primary `github-actions[bot]` review returned 🟡 "Has issues — 2 gaps, 0 bugs". The load-bearing gap: "`-Og` may promote uninitialized-value warnings absent under `-O0`; `-Wno-maybe-uninitialized` is only applied under `USE_FEWER_WARNINGS`, and the macOS Debug Clang CI job defaults `warnings-as-errors: true`." That reads like a plausible OPEN_GAP → ABSTAIN_POLICY.

## Root cause / why it CLEARS
The gap's *mechanism* is real — the reusable `.github/workflows/ci-slang-build.yml` defaults `warnings-as-errors: true`, and `build-macos-debug-clang-aarch64` (in `ci.yml`) does NOT override it, so that build genuinely runs `-DCMAKE_COMPILE_WARNING_AS_ERROR=true`. A newly-promoted warning WOULD break it. But the predicted failure is a **build break**, which is fully CI-visible, and at the pinned head that exact leg (`build-macos-debug-clang-aarch64` + `test-macos-debug-clang-aarch64`) was GREEN. Two extra facts sealed it: (1) `-Wmaybe-uninitialized` is a **GCC-only** diagnostic — Clang treats it as an ignored no-op, so the "macOS Clang" framing was partly misdirected; the GCC debug legs (linux x86_64/aarch64) that *could* emit it were also green. (2) Blast radius is Debug-config + GCC/Clang only — cannot touch Release codegen or MSVC.

## How to catch it (transferable)
For a **build-flag / optimization-level PR** where the review flags "this flag might promote a warning and break `-Werror` CI":
1. This is a **CI-catchable class** — the failure would be a build break, not a silent runtime miscompile. So the decisive probe is: does CI actually *exercise* the affected config, and is it **green at the pinned head**?
2. Enumerate the affected legs precisely: match `warnings-as-errors` in the reusable workflow's `inputs` **default** (not just per-job overrides — the default applies when a job omits the key), then confirm the *build* AND *test* check-runs for those exact `os/compiler/config` tuples are `success`.
3. Know the diagnostic's compiler scope: `-Wmaybe-uninitialized` = GCC only; don't accept a "Clang will break on -Wmaybe-uninitialized" claim at face value.
4. If every affected debug-build leg is green → the gap CLEARS (advisory); the trigger did not fire on the exercised path. If the affected leg is red/absent/pending → do NOT clear (that's the #12122/#12130 incomplete-CI false-safe trap).

## Fix
Recorded WOULD_APPROVE (CLEAN); human jkwak-work had already APPROVED at the same head. Confirmed: **for a build-flag PR whose only risk is a CI-visible build break, complete + green CI on the exact affected config legs is sufficient to clear a speculative "-Werror" warning gap.** Contrast with codegen/logic PRs where green CI ≠ safe (a miscompile can pass all tests). The distinguishing question: "is the worst realistic failure a build error CI would catch, or a silent behavioral change it wouldn't?"

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784270606102-approver-calibration-build-flag-pr-clear-a-werror-.md`_
