# Verifying a guard fix: enumerate the diagnostic's distinct pairs, and prove the negative arm reproduces first

Two verification steps that came out of slangpy#1087 (the `hlsl_nvapi` guard blocking slang#11225). Both generalize to any "add a guard so a new compiler diagnostic stops firing" fix.

**Companion concept — the *sequencing* half of this same chain lives in [`1785478041840-a-slangpy-test-fixture-guard-can-be-the-prerequisi.md`](1785478041840-a-slangpy-test-fixture-guard-can-be-the-prerequisi.md):** why the downstream guard is the *prerequisite* (an open/draft PR can't flip the upstream check, because `ci-latest-slang.yml`'s `build-pr` checks slangpy out at its default branch), the Stage-1/Stage-2 split, the configure-output diff that reveals the guard predicate, and the drafts-only-vs-must-merge tension. This file = *is the guard right and actually tested*; that file = *when does it land and in what order*.

## 1. A single-site fix is only *complete* if the diagnostic names exactly one thing

When a new diagnostic fires N times and you propose a one-line guard, "consistency with the other N guarded sites" shows the fix is **idiomatic**, not that it is **sufficient**. The closing step is to enumerate the distinct subjects the diagnostic actually names:

```bash
grep -ao "requested capability '[^']*' is incompatible with compilation target '[^']*'" job.log | sort | uniq -c
```

On #1087 this returned exactly one distinct pair (`hlsl_nvapi` → `spirv`), 28× per platform. Had a *second* capability appeared, the one-site fix would have been incomplete and a broader audit forced — and the original triage memo, which recommended one site and ruled the audit out of scope, would have been wrong in a way its own cited evidence could not catch. Run the enumeration **before** recommending a single-site fix, not after.

## 2. With a version pin, the "fix works" arm is worthless without a reproducing "bug happens" arm

slangpy pins `SGL_SLANG_VERSION` (`external/CMakeLists.txt:85`) to a released tarball. When the bug is introduced by an *unreleased* upstream change, a build against the pin **cannot reproduce it** — the pin predates the change. So a green local test proves *no regression* and nothing whatsoever about the bug.

Closing the loop needs an A/B against a local build of the upstream PR (`SGL_LOCAL_SLANG=ON`, `SGL_LOCAL_SLANG_DIR`, `SGL_LOCAL_SLANG_BUILD_DIR` — the same mechanism CI uses):

- **without** the guard → must show the error, verbatim, captured in the PR body as reproduction proof
- **with** the guard → must be clean

The **without-guard arm is the load-bearing half.** If it comes back clean, the correct conclusion is "locally unproven; rests on CI plus code inspection" — a *negative result*, not a pass. Shipping on the with-guard arm alone reduces to observing that a test which never triggers the bug doesn't trigger the bug. Also confirm the harness creates real devices (a GPU-skipped run makes the A/B vacuous regardless of outcome).

## Corollaries worth keeping

- **Sequencing for a downstream fix pinned to upstream releases: merge → tag → bump.** Not "wait for a tag" — an unmerged PR is in no tag *because* it is unmerged. Check `merged`/`merged_at` via REST, and list actual release tags; don't infer.
- **A guard arm you cannot exercise locally must be declared, not implied.** With `SGL_HAS_D3D12: OFF` in the container, the `true` arm rests on CI's Windows job (where d3d12 passed on the unguarded code and must keep passing). State it as a caveat in the PR.
- **Opening a draft is not gated by the same things that gate promoting it.** A downstream-sequencing dependency blocks leaving draft; it does not block opening the draft with that work marked in-flight.
