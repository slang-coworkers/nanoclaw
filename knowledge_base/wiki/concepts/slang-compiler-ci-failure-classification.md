---
title: "Slang CI failure classification: gate noise, lost GitHub refs, and stale queue statuses"
type: concept
group: slang-grab-bag
tags: [slang, CI, issue-onboard, gh-readonly-queue, pull-refs, slangpy-tests, ci-latest-slang, noise, triage]
source_count: 2
---

# Slang CI failure classification: gate noise, lost GitHub refs, and stale queue statuses

Not every red CI run on shader-slang/slang is a code regression. This page collects the failure classes that look like regressions but are infrastructure or tracked noise: the "Issue Onboard" GraphQL gate, GitHub-side loss of `refs/pull/N/head`, and months-old FAILED statuses on merge-queue refs of long-closed PRs.

## TL;DR

- "Issue Onboard" workflow GraphQL `Type mismatch` failures are a KNOWN noise class tracked by fix PR #12982 — never flag them as a new regression or propose filing an issue.
- GitHub can lose `refs/pull/<N>/head` for an OPEN fork PR; slangpy's `SlangPy Tests` then fails deterministically on both OSes and looks exactly like a code regression. Probe with `git ls-remote` + the git-ref API before rerunning.
- `gh-readonly-queue/master` refs for long-merged/closed PRs can carry months-old FAILED statuses with no live problem — check the PR's state and the check dates before treating a red queue ref as a finding.
- Classification decides the verb: tracked noise → report INFO only; missing pull ref → do NOT rerun until `ls-remote` resolves; stale queue status → ignore.

## "Issue Onboard" GraphQL failures are tracked noise (PR #12982)

shader-slang/slang "Issue Onboard" workflow failures (GraphQL `Type mismatch on variable $iteration and argument iterationId (ID! / String)`) are a KNOWN gate-noise class, tracked by fix PR #12982 (open since 2026-09-09) — never flag them as a new/untracked regression or propose filing an issue (parent correction 2026-11-17). As of the 2026-11-18 scan the error text confirms #12982's "pass Sprint iteration ids as GraphQL String" approach is INVERTED by an API change (the argument now wants `ID!`), so the fix PR likely needs rework — report that as INFO only; a maintainer owns the PR. From the same scan: `gh-readonly-queue/master` refs for long-merged/closed PRs (pr-12968 from Sept, pr-10303/pr-10321 from March 2026) can carry months-old FAILED statuses (e.g. a stale `SlangPy Tests` red) with no live problem — always check the PR's state and the check dates before treating a failing queue ref as a finding [Slang Issue Onboard GraphQL failures = tracked noise; fix PR #12982 direction now inverted](../learnings/1795017874468-slang-issue-onboard-graphql-failures-tracked-noise.md).

## GitHub can lose refs/pull/N/head on an open fork PR (#14602)

GitHub can lose `refs/pull/<N>/head` for an OPEN fork PR — `git ls-remote https://github.com/shader-slang/slang.git refs/pull/N/head` returns nothing and `gh api repos/.../git/ref/pulls/N/head` 404s, while `refs/pull/N/merge` still resolves and the REST PR object still carries the correct head sha. Seen on shader-slang/slang#14602 (created 2026-11-18 from fork jkwak-work/slang): the slangpy `ci-latest-slang` "pr" checkout mode (tools/ci.py `checkout_slang`) clones shader-slang/slang then `git fetch origin pull/N/head`, which fails all retries ("couldn't find remote ref") and fails the whole `SlangPy Tests` run on both OSes — looks exactly like a code regression but is pure GitHub-side ref loss. Distinguish from transient network: ls-remote + git-ref API are the cheapest falsifying probes; a real miss 404s both, a transient blip does not. Classification: deterministic while the ref is missing — do NOT rerun/re-dispatch until the ref exists (verify with ls-remote first; recovery when it returns is `gh workflow run ci-slangpy-trigger-test.yml --repo shader-slang/slang -f pr_number=N`, or the author pushes any new commit) [GitHub lost refs/pull/N/head on open fork PR — slangpy SlangPy Tests deterministic fetch failure](../learnings/1795032618974-github-lost-refs-pull-n-head-on-open-fork-pr-slang.md).

**Source learnings (2):**
- [Slang Issue Onboard GraphQL failures = tracked noise; fix PR #12982 direction now inverted](../learnings/1795017874468-slang-issue-onboard-graphql-failures-tracked-noise.md) — known noise class; also stale months-old FAILED statuses on gh-readonly-queue refs of closed PRs
- [GitHub lost refs/pull/N/head on open fork PR — slangpy SlangPy Tests deterministic fetch failure](../learnings/1795032618974-github-lost-refs-pull-n-head-on-open-fork-pr-slang.md) — ls-remote + git-ref API probes; don't rerun until the ref resolves

_Catalog: [[wiki/index.md]]_
