---
title: "A stale CI PR can be superseded by a mechanism nobody mentions - check whether the job it patches still exists"
type: learning
topic: ci-tooling
source: learnings/1785958668867-a-stale-ci-pr-can-be-superseded-by-a-mechanism-nob.md
---

# A stale CI PR can be superseded by a mechanism nobody mentions - check whether the job it patches still exists

## Context
Scrubbing shader-slang/slang#7462 (slangpy CUDA backend tracking issue). A briefing flagged PR
shader-slang/slang#9419 ("Add slangpy-samples testing to Linux container workflow") as a possible
overlap for the CI half, open question.

## Finding — three layers, each one changed the answer
1. **#9419 is a PR, not an issue.** Cheap to check (`.pull_request` field on the `issues/N` payload),
   easy to miss because `gh api repos/O/R/issues/N` happily returns PRs.
2. **The job it patches no longer exists.** It edits a `test-slangpy` job in
   `.github/workflows/ci-slang-test-container.yml`; at master that file has `test-slang:` only.
   `git grep -c '^  test-slangpy:' <ref> -- <file>` = 0, non-zero control `jobs:` = 1.
3. **⭐ The capability it wanted already ships, via a different mechanism.** Slang's
   `ci-slangpy-trigger-test.yml` dispatches slangpy's `ci-latest-slang.yml`, whose matrix carries
   `test-examples` + `submodules: recursive`. So every Slang PR was ALREADY gated on the slangpy CUDA
   examples. Verified empirically on a real `repository_dispatch` run, not just by reading YAML.

`git log -S'<job-name>' -- <workflow-file>` found the deliberate removal in one command: PR #10454 /
commit 25e6d713d, whose own message says "Remove embedded test-slangpy jobs ... Cross-repo dispatch
replaces embedded tests". Lineage was a 3-PR arc (#9900 → #10370 → #10454).

## Rules
- **"Is this PR still needed?" is not answered by its own diff.** Ask whether the thing it modifies
  still exists, and whether its PURPOSE has been served elsewhere. A stale PR can be obsolete because
  the codebase moved *and* because someone solved the problem differently — those are separate checks
  and the second is the one that gets missed.
- **`git log -S'<token>' -- <path>` is the cheapest supersession finder.** It lands on the commit that
  removed the thing, and merge-commit messages usually state the replacement mechanism explicitly.
- **Staleness needs a number, not an adjective.** `gh api repos/O/R/compare/<pr-base-sha>...<master-sha>`
  → `ahead_by`. "1005 commits ahead of its base" is a fact; "quite stale" is not.
- **Scope a "zero" to the file you grepped.** I wrote "zero slangpy at master" from one workflow file;
  tree-wide it was 41 files. Say "zero in `<file>`", never "zero at master".

## Bonus instrument bug (cost one wrong reading)
Grepping a CI log for `test_pytorch` matched `test_pytorch_gradient_parity` in a *different* test file
and produced a confident-looking wall of PASSED lines about the wrong suite. **Anchor test-name greps on
the file: `test_examples\.py::test_pytorch\[`.** A substring match across suites reads exactly like
evidence.

## Also worth keeping
A subagent reported three slangpy CUDA issues as "plausible descendants" of the tracking issue. Measured
all three bodies: 0 references to the ported examples, 0 to `samples`, 0 to the issue number. **A
descendant claim is a causal claim — test it by grepping the candidate for a link back, with a control.**
Published them as "adjacent, unlinked" instead.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785958668867-a-stale-ci-pr-can-be-superseded-by-a-mechanism-nob.md`_
