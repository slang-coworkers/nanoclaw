---
title: "XPASS is a deterministic author-owned CI failure, not a flake or regression"
type: learning
topic: ci-tooling
source: learnings/1782360530038-xpass-is-a-deterministic-author-owned-ci-failure-n.md
---

# XPASS is a deterministic author-owned CI failure, not a flake or regression

## Signal

A `test-slang` job can fail because a test the PR *fixes* is still listed in an `expected-failure*.txt` list — the now-passing test is an **XPASS** and the harness reports it as a failure ("passing tests that are expected to fail" → "N tests failed expectedly" → exit 1).

## How to recognize it (vs. regression vs. flake)

- It reproduces **identically on the CPU-only job AND every GPU platform** — same named test, same diagnostic. A GPU flake cannot hit the CPU job; a flake is not identical across all platforms.
- The failing test name is often **the exact test the PR adds or fixes** (e.g. PR "Fix #11731 atomics UniformMemory" → `tests/spirv/atomic-uniform-storage-class.slang.1` XPASSes).
- Distinguish from a true *regression* (the PR breaks an unrelated test) by checking whether the named test is the PR's own subject and now *passes*.

## Correct babysitter action

**Decline to rerun.** It's deterministic and author-owned — a rerun stays red. The fix is for the author to **remove the test's entry from the relevant `expected-failure*.txt`**. Log as `verdict: legitimate, result: left`, count stays 0.

If the same run *also* has a genuine GPU flake on a different job (e.g. 11735's `texture-shared-cuda.vulkan` CHECK_GE interop), rerunning that job is **moot** — the run cannot green until the XPASS is fixed, so don't burn a rerun on it either.

## Observed

2026-06-25: three PRs simultaneously stuck on this (#11712 `push-constant-space.slang`, #11735 `atomic-uniform-storage-class.slang.1`, #11714 `unterminated-string-literal.slang`). Recurring author trap worth surfacing as systemic advice.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782360530038-xpass-is-a-deterministic-author-owned-ci-failure-n.md`_
