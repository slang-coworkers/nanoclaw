---
title: "[approver/clause-gap] Verify a workaround PR's premise against the PINNED dependency version, never master"
type: learning
topic: review-approval
source: learnings/1785764986434-approver-clause-gap-verify-a-workaround-pr-s-premi.md
---

# [approver/clause-gap] Verify a workaround PR's premise against the PINNED dependency version, never master

## Symptom

A "temporarily disable X, workaround for an upstream bug" PR asserts a bug in a dependency.
Checking the dependency's **master** can refute the premise and lead you to flag the
mitigation as unnecessary — when master has since been fixed but the consumer still pins
an older release.

slang-rhi#807 disabled `metallib_4_0` citing slang#12325. In slang **master** the fix is
present (`slang-code-gen.cpp:779-786` sets `options.metalLanguageVersion = SemanticVersion(4,0)`
when the target implies `metallib_4_0`), so a master-based check says "already fixed, why
this PR?" That would have been wrong.

## Root cause

The consumer pins a release, not master:

```
CMakeLists.txt:148  set(SLANG_RHI_FETCH_SLANG_VERSION "2026.12.2" ...)
CMakeLists.txt:306  set(SLANG_HASH_VERSION "2026.12.2")   # + per-platform SHA256
```

Against the **pinned tag** both halves of the premise hold:
- `v2026.12.2:source/slang/slang-emit-metal.cpp:215` gates
  `[[required_threads_per_threadgroup(...)]]` on `metallib_4_0`;
- `v2026.12.2:source/compiler-core/slang-gcc-compiler-util.cpp:973` hard-codes
  `-std=metal3.1`; `metalLanguageVersion` is never set in that tag and
  `getRequiredMetalLanguageVersion` doesn't exist there at all.

The commit that fixes it (`a2596654`, 2026-07-14) is **not** an ancestor of v2026.12.2
(tag cut 2026-07-01).

## How to catch it

Two commands settle it — run them before judging any cross-repo workaround:

```bash
# 1. what does the consumer actually pin?
grep -n 'FETCH_.*VERSION\|HASH_VERSION' CMakeLists.txt

# 2. is the fix in that pin? (answers the premise directly)
git merge-base --is-ancestor <fix-sha> <pinned-tag> && echo IN || echo NOT-IN
git tag --contains <fix-sha> | sort -V | head   # which release first carries it
```

Then read the relevant source **at the tag**, not the worktree:
`git show <tag>:path/to/file.cpp | grep -n ...`. A worktree grep silently answers for
master. Corollary: a stale local `main` also fabricates diff noise — verify a PR's true
diff against the *PR's real base SHA* (`git diff <base>...<head>`), not `main...HEAD`;
mine showed 8 phantom `.github/**` files (which would have tripped the protected-path
clause) purely because local `main` was 3 weeks behind.

## Fix

Premise verified → the mitigation is real, correctly-layered (unfixable from the consumer),
and upstream-tracked. Judge the mitigation on its own merits from there. Generalizes to any
consumer→dependency workaround: slang-rhi/slangpy pinning a Slang release, a lockfile pin,
a vendored dep. **"Fixed upstream" is only relevant if it's fixed in the version that
actually builds.**

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785764986434-approver-clause-gap-verify-a-workaround-pr-s-premi.md`_
