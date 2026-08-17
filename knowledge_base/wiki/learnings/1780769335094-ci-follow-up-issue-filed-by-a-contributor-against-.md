---
title: "CI follow-up issue filed by a contributor against their own still-open PR → stand down to plan-only"
type: learning
topic: ci-tooling
source: learnings/1780769335094-ci-follow-up-issue-filed-by-a-contributor-against-.md
---

# CI follow-up issue filed by a contributor against their own still-open PR → stand down to plan-only

**Pattern:** An issue that is (a) authored by, (b) assigned to, and (c) tracking a still-OPEN PR owned by the *same* person is contributor-owned. Stand down to a read-only plan; do NOT ship a competing/follow-up PR. (slang#11500 — issue author == assignee == PR #11497 author == jkwak-work, 2026-06-06.)

**Three independent reasons converged on stand-down for slang#11500 — useful as a checklist for this whole class:**

1. **Contributor-owned (the dispositive one).** Same shape as the slang#11441 stand-down. The author is actively working the related PR; our follow-up = competing PR.

2. **Amend-in-place beats a follow-up PR when the causal PR hasn't merged.** PR #11497 was OPEN (`mergedAt: null`), so the workaround it introduced (`tests/expected-failure-aarch64.txt` + a 4-line workflow conditional) lived only on the PR branch, not on master. Cleaning it up = one in-place amendment by the author, vs. our path of "wait for merge, then a second PR." Fewer PRs, smaller diff, no mid-state.

3. **Bot `workflows`-perm gap makes the full diff un-shippable by us anyway.** `nv-slang-bot[bot]` has no `workflows` App permission (see `legoop-feedback_no_workflows_perm_for_bot.md`). The recommended fix (Approach A) needed a revert of an `.github/workflows/ci-slang-test.yml` conditional. Bot CAN push the `tests/expected-failure-*.txt` edits but CANNOT push the workflow edit → a bot-authored PR would leave dangling workflow plumbing pointing at a deleted file. Splitting it leaves CI in an inconsistent mid-state. (Same constraint surfaced on slang#11438 / PR #11439.)

**Also: slang-fixer is the wrong persona for pure CI/test-infra issues** (yaml + plain-text expected-failure lists, no compiler code). Triager flagged `Not-compiler-code: yes — bounce back if out of scope`; that's the correct read even setting aside ownership.

**Technical note worth keeping (Approach A mechanics for expected-failure reconciliation):** aarch64 CI jobs already pick up `tests/expected-failure-no-gpu.txt` because `ci-slang-test.yml` appends it whenever `full-gpu-tests != true`, and both Linux-aarch64 jobs set `full-gpu-tests: false`. So appending the four Vulkan gfx-unit-tests to no-gpu.txt has *identical* effect on aarch64 as a dedicated aarch64-only file — making the aarch64-specific file redundant. The unverified assumption is "aarch64 failure == no-GPU failure (not arch-specific)"; only a CI run on the branch (both `test-linux-debug-gcc-aarch64` and x86_64 `test-linux-debug-gcc` green) proves it. `expected-failure` lists *reclassify* a failing exit code to ignored — they can't suppress a *crashing* test; PR #11497's aarch64 release-test passing with the new file confirmed the four exit cleanly (clean SLANG_FAIL via `SLANG_IGNORE_TEST`), so the mechanism is safe.

**Guardrail re-confirmed this chain:** user-facing GitHub writes stayed operator-gated even under a general parent "GitHub is the primary artifact" reinforcement — a *general* reinforcement is not the *explicit scoped authorization* the gate requires. Surfaced the conflict to parent and held, rather than inferring authorization.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780769335094-ci-follow-up-issue-filed-by-a-contributor-against-.md`_
