---
title: "slang-rhi CI DOES run GPU tests — check-run names all say 'build (...)', so never infer coverage from the name"
type: learning
topic: ci-tooling
source: learnings/1785937835338-slang-rhi-ci-does-run-gpu-tests-check-run-names-al.md
---

# slang-rhi CI DOES run GPU tests — check-run names all say "build (...)", so never infer coverage from the name

Reviewing slang-rhi#812 I told the requester "slang-rhi has no GPU test job — every check is build-only, so green CI proves compilation, not interop." **Wrong, and it nearly buried the single best piece of evidence in the review.**

Every check-run in slang-rhi is named `build (os, arch, compiler, config)` — including the ones that build **and run the full test suite on real GPU hardware**. `.github/workflows/ci.yml` gates the test step on a matrix `flags` field, not on the job name:

```yaml
- name: Unit Tests
  if: contains(matrix.flags, 'unit-test')
  run: ./slang-rhi-tests -check-devices
```

The self-hosted GPU runners are the `include:` entries carrying `runs-on: { labels: [Windows, X64, nvrgfx-kernelvm-bridge] }` with `flags: "unit-test,coverage"` / `"unit-test"`. On the PR head, `build (windows, x86_64, msvc, Release)` ran **1265 test cases, 0 failed, 0 skipped** — and included `texture-shared-cuda.vulkan PASSED`, the exact Windows-only same-adapter CUDA↔Vulkan interop repro that everyone (the fixer's own PR body, the dispatch, and I) had written off as unobtainable outside a Windows GPU box.

**How to check, cheaply:** `gh run view <run-id> -R shader-slang/slang-rhi --log --job <job-id> | grep -i "<test-name>"`. Get the job id from `gh pr checks` URLs, or `gh api repos/.../commits/<sha>/check-runs`. Look for the doctest tally line (`[doctest] test cases: N | N passed | 0 failed | M skipped`) to confirm tests ran at all, and grep the specific case name to see PASSED vs SKIPPED.

**Root trap — this is the [green macOS job ≠ backend tested] learning run in reverse.** That one warns a green job can hide a fully-skipped backend. The mirror failure is just as costly: a job *named* `build` can be silently doing the most valuable verification in the pipeline. In both directions the fix is the same — **read the workflow's test step and the run log; never infer coverage from a check-run name.** And when a repro is claimed unrunnable, verify that claim against CI before repeating it: "cannot be tested here" is about *your* container, not about the project.

Corollary for skip-checking: `0 skipped` on the full suite is a strong positive signal that conditional `SKIP()` guards (CUDA-unavailable, adapter-LUID mismatch) did not fire. Check the skip *count and reasons*, not just pass/fail.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785937835338-slang-rhi-ci-does-run-gpu-tests-check-run-names-al.md`_
