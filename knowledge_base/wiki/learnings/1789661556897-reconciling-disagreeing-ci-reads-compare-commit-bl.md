---
title: "Reconciling disagreeing CI reads: compare commit/blob SHAs across timestamps before assuming misattribution"
type: learning
topic: ci-tooling
source: learnings/1789661556897-reconciling-disagreeing-ci-reads-compare-commit-bl.md
---

# Reconciling disagreeing CI reads: compare commit/blob SHAs across timestamps before assuming misattribution

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1789660303908-x9k5qe
written_at: 2026-09-17T16:12:36.897Z
---

# Reconciling disagreeing CI reads: compare commit/blob SHAs across timestamps before assuming misattribution

When two CI reads taken at different times disagree (e.g. "run X shows all-platform test-slang regression" vs. "current head is 59/green, only a known flake"), don't default to assuming one side misread the data. Check whether the PR's own history moved between the two checks first:

1. Pull the failing run's `head_sha` (for `merge_group` events this is a synthetic queue-merge commit, not the PR's actual head — get the real PR head separately via `gh pr view --json headRefOid`).
2. Diff the specific failing file's blob SHA at the failing run's commit vs. the PR's current head (`gh api repos/<o>/<r>/contents/<path>?ref=<sha> -q .sha`). Different blob SHA = content changed between the two checks.
3. Check the PR's commit list (`gh pr view --json commits`) for a commit timestamped between the two runs — often the fix, sometimes titled descriptively enough to confirm it addresses the same feature the failing test exercises.
4. A `merge_group` run rolling off a "last 100 merge_group runs" search window is expected once enough queue throughput has occurred since — absence from that search does NOT mean the run never existed or was misattributed to another PR. Don't conclude "fabricated/wrong PR" from a bounded-window search coming up empty; fetch the run directly by ID if you have one and check its `head_branch` for the `pr-<N>` substring.

Concrete case (2026-09-17, shader-slang/slang PR #13033): a merge-group run at 02:19:41Z genuinely failed with a real FileCheck bug in the PR's own new test (`early-fragment-tests-generic.slang`) across 16 jobs/9 platforms — correct classification at that moment. The author pushed a fix commit at 05:13:19Z ("Accept GLSL layout(early_fragment_tests) in; under -allow-glsl") that changed that file's blob SHA. A head-check run at 05:33:06Z on the fixed head was all-green except an unrelated Falcor flake. Both the "genuine regression" call and the later "clean, 59 green" call were correct — for their respective timestamps. No misattribution occurred; the PR just got fixed in between.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789661556897-reconciling-disagreeing-ci-reads-compare-commit-bl.md`_
